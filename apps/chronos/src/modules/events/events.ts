import type {
  EventCreateInput,
  EventUpdateInput,
} from '@filcdev/api/domains/events/event';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { and, asc, count, eq, gte, type SQL } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { recordActivity } from '#modules/activity-log/utils/record';
import { event, eventRegistration } from '#modules/events/schema';
import {
  canManageEvents,
  EVENT_AUDIT_FIELDS,
  eligibilityFor,
  eventFields,
  helperEligibilityFor,
  presentEvent,
  resolveEventViewer,
  toEventItem,
} from '#modules/events/utils/events';
import { assertHelperRequirements } from '#modules/events/utils/helper-requirements';
import {
  myConfirmedEventIds,
  registrationWithAnswers,
} from '#modules/events/utils/registrations';
import { seatCounts, toSeats } from '#modules/events/utils/seats';
import { validateCohortIds } from '#modules/news/utils/cohort';
import { base } from '#orpc';
import { badRequest, conflict, notFound } from '#utils/http';
import { deleteObject } from '#utils/storage/s3';
import { diffActivity, valuesEqual } from '#utils/values';

const logger = getLogger(['chronos', 'events']);

/** The columns a PATCH changes; fields absent from the body stay untouched. */
function eventUpdateValues(body: EventUpdateInput): Record<string, unknown> {
  // The contract object is exactly the writable columns, so the written set is
  // the body without the keys the caller left out.
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined)
  );
}

/**
 * The columns a PATCH really changes: a value equal to the stored one is not a
 * write, so resending the stored values leaves the row — and its `updatedAt` —
 * untouched. Judged with the same comparison the audit uses, `cohortIds`
 * included (it is a plain column), so the write set and the audited set agree.
 */
function changedEventValues(
  existing: typeof event.$inferSelect,
  body: EventUpdateInput
): Partial<typeof event.$inferInsert> {
  const changed = Object.fromEntries(
    Object.entries(eventUpdateValues(body)).filter(
      ([key, value]) =>
        !valuesEqual(existing[key as keyof typeof existing], value)
    )
  );
  return changed as Partial<typeof event.$inferInsert>;
}

export const listEvents = base.events.list.handler(
  async ({ context, input }) => {
    const { category, includeDrafts, limit, offset, status } = input;
    const canManage = await canManageEvents(context.user?.id);

    logger.debug('listing events', {
      canManage,
      category,
      includeDrafts,
      limit,
      offset,
      requestId: context.requestId,
      status,
    });

    const conditions: SQL[] = [];
    if (!canManage) {
      // A caller who may not manage events only ever sees published rows: a
      // `status=draft` request narrows nothing and cannot leak a draft.
      conditions.push(eq(event.status, 'published'));
      // The public list is what is still ahead. An organizer's table keeps the
      // past, because that is where they look for what happened.
      conditions.push(gte(event.endsAt, new Date()));
    } else if (status) {
      // A manager's `status` narrows the list on its own, whether or not the
      // request also asks for drafts.
      conditions.push(eq(event.status, status));
    } else if (!includeDrafts) {
      // No status and no draft flag: the public default, even for a manager.
      conditions.push(eq(event.status, 'published'));
    }
    if (category) {
      conditions.push(eq(event.category, category));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(event)
        .where(where)
        .orderBy(asc(event.startsAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(event).where(where),
    ]);

    // Two extra queries for the whole page rather than two per row: the seat
    // counts and the caller's own confirmed registrations.
    const viewer = await resolveEventViewer(context.user?.id);
    const eventIds = rows.map((row) => row.id);
    const [counts, mine] = await Promise.all([
      seatCounts(eventIds),
      myConfirmedEventIds(context.user?.id, eventIds),
    ]);

    const items = rows.map((row) => {
      const taken = counts.get(row.id) ?? 0;
      return toEventItem(
        row,
        toSeats(row.capacity, taken),
        eligibilityFor(row, viewer, {
          pending: false,
          registered: mine.has(row.id),
          taken,
        })
      );
    });

    return { items, total: totalResult[0]?.count ?? 0 };
  }
);

export const getEvent = base.events.get.handler(async ({ context, input }) => {
  const { id, includeDrafts } = input;
  const canManage = await canManageEvents(context.user?.id);
  const includeAll = includeDrafts && canManage;

  const [row] = await db.select().from(event).where(eq(event.id, id));

  // A draft or archived event is indistinguishable from a missing one to a
  // caller who may not manage events.
  if (!row || (!includeAll && row.status !== 'published')) {
    throw notFound('Event not found');
  }

  const viewer = await resolveEventViewer(context.user?.id);
  const [fields, myRegistration] = await Promise.all([
    eventFields(id),
    registrationWithAnswers(id, context.user?.id),
  ]);
  const registrationState = {
    pending: myRegistration?.status === 'pending',
    registered: myRegistration?.status === 'confirmed',
  };
  const item = await presentEvent(row, viewer, registrationState);

  logger.debug('event detail read', {
    eligible: item.eligibility.eligible,
    eventId: id,
    requestId: context.requestId,
  });

  return {
    ...item,
    fields,
    helperEligibility: helperEligibilityFor(
      row,
      viewer,
      registrationState,
      fields,
      myRegistration?.answers ?? []
    ),
    myRegistration,
  };
});

/**
 * The insert values of a new event: every optional column with its default in
 * one place, so the handler stays a read-and-write rather than a default map.
 */
function eventInsertValues(
  body: EventCreateInput,
  createdBy: string
): typeof event.$inferInsert {
  return {
    capacity: body.capacity ?? null,
    category: body.category,
    cohortIds: body.cohortIds ?? [],
    createdBy,
    description: body.description,
    endsAt: body.endsAt,
    guestRegistrationEnabled: body.guestRegistrationEnabled ?? false,
    helperRegistrationClosesAt: body.helperRegistrationClosesAt ?? null,
    helperRegistrationEnabled: body.helperRegistrationEnabled ?? false,
    helperRegistrationOpensAt: body.helperRegistrationOpensAt ?? null,
    helperRegistrationSeparateWindow:
      body.helperRegistrationSeparateWindow ?? false,
    helperRequirements: body.helperRequirements ?? [],
    maxGrade: body.maxGrade ?? null,
    minGrade: body.minGrade ?? null,
    registrationClosesAt: body.registrationClosesAt ?? null,
    registrationEnabled: body.registrationEnabled ?? true,
    registrationOpensAt: body.registrationOpensAt ?? null,
    startsAt: body.startsAt,
    status: body.status ?? 'published',
    title: body.title,
  };
}

export const createEvent = base.events.create
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, errors, input }) => {
    const body: EventCreateInput = input;

    if (body.cohortIds && body.cohortIds.length > 0) {
      await validateCohortIds(body.cohortIds);
    }

    // A new event has no questions yet (they are replaced after the create), so
    // a requirement here could only name another event's field. Reject it now.
    assertHelperRequirements([], body.helperRequirements ?? []);

    const [created] = await db
      .insert(event)
      .values(eventInsertValues(body, context.session.userId))
      .returning();
    if (!created) {
      throw errors.INTERNAL({ message: 'Failed to create event' });
    }

    await recordActivity(context, {
      action: 'create',
      entityId: created.id,
      entityType: 'event',
    });

    logger.info('event created', {
      category: created.category,
      eventId: created.id,
      requestId: context.requestId,
      status: created.status,
    });

    return presentEvent(created, await resolveEventViewer(context.user?.id));
  });

/**
 * The cross-field bounds judged against the row a PATCH produces, not just the
 * fields the patch happens to carry.
 */
function assertEventBounds(
  existing: typeof event.$inferSelect,
  body: EventUpdateInput
): void {
  const startsAt = body.startsAt ?? existing.startsAt;
  const endsAt = body.endsAt ?? existing.endsAt;
  if (endsAt < startsAt) {
    throw badRequest('The event must end on or after it starts');
  }

  const opensAt =
    body.registrationOpensAt === undefined
      ? existing.registrationOpensAt
      : body.registrationOpensAt;
  const closesAt =
    body.registrationClosesAt === undefined
      ? existing.registrationClosesAt
      : body.registrationClosesAt;
  if (opensAt && closesAt && closesAt < opensAt) {
    throw badRequest('Registration must close on or after it opens');
  }

  const minGrade =
    body.minGrade === undefined ? existing.minGrade : body.minGrade;
  const maxGrade =
    body.maxGrade === undefined ? existing.maxGrade : body.maxGrade;
  if (minGrade != null && maxGrade != null && maxGrade < minGrade) {
    throw badRequest('The maximum grade must be at least the minimum grade');
  }

  const helperOpensAt =
    body.helperRegistrationOpensAt === undefined
      ? existing.helperRegistrationOpensAt
      : body.helperRegistrationOpensAt;
  const helperClosesAt =
    body.helperRegistrationClosesAt === undefined
      ? existing.helperRegistrationClosesAt
      : body.helperRegistrationClosesAt;
  if (helperOpensAt && helperClosesAt && helperClosesAt < helperOpensAt) {
    throw badRequest('Helper registration must close on or after it opens');
  }
}

export const updateEvent = base.events.update
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const { id, ...body } = input;

    const [existing] = await db.select().from(event).where(eq(event.id, id));
    if (!existing) {
      throw notFound('Event not found');
    }

    assertEventBounds(existing, body);

    if (body.cohortIds && body.cohortIds.length > 0) {
      await validateCohortIds(body.cohortIds);
    }

    if (body.helperRequirements !== undefined) {
      assertHelperRequirements(await eventFields(id), body.helperRequirements);
    }

    const values = changedEventValues(existing, body);
    const changedKeys = Object.keys(values);
    let updated = existing;

    // A PATCH that only resends stored values changes nothing: no statement,
    // no `updatedAt` bump, no audit line.
    if (changedKeys.length > 0) {
      const [changed] = await db
        .update(event)
        .set(values)
        .where(eq(event.id, id))
        .returning();
      if (!changed) {
        throw notFound('Event not found');
      }
      updated = changed;
    }

    // Audit only what the PATCH touched, judged against the row it started
    // from — `cohortIds` is a plain column, so it compares like the rest.
    const diff = diffActivity(existing, body, EVENT_AUDIT_FIELDS);
    if (diff) {
      await recordActivity(context, {
        action: 'update',
        entityId: id,
        entityType: 'event',
        metadata: diff,
      });
    }

    logger.info('event updated', {
      changed: Object.keys(diff?.after ?? {}),
      eventId: id,
      requestId: context.requestId,
      wrote: changedKeys.length > 0,
    });

    return presentEvent(updated, await resolveEventViewer(context.user?.id));
  });

export const deleteEvent = base.events.delete
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const { id } = input;

    // Registrations, answers and tickets cascade from the event row, so the
    // delete is refused while any registration exists: that history is not
    // the cascade's to decide. The event lock is the one the registration
    // paths take, so nobody can register between the count and the delete.
    const deleted = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(event)
        .where(eq(event.id, id))
        .for('update');
      if (!row) {
        throw notFound('Event not found');
      }

      const [registered] = await tx
        .select({ count: count() })
        .from(eventRegistration)
        .where(eq(eventRegistration.eventId, id));
      if ((registered?.count ?? 0) > 0) {
        throw conflict('This event already has registrations');
      }

      const [gone] = await tx.delete(event).where(eq(event.id, id)).returning();
      if (!gone) {
        throw notFound('Event not found');
      }
      return gone;
    });

    // The row is gone either way; a failed object delete must not turn a
    // successful delete into a 500.
    if (deleted.imageKey) {
      try {
        await deleteObject(deleted.imageKey);
      } catch (error) {
        logger.warn('Failed to delete the banner of a deleted event', {
          error,
          eventId: id,
          key: deleted.imageKey,
          requestId: context.requestId,
        });
      }
    }

    // The row is gone; an audit write that fails must not turn the delete into
    // a 500 the caller reads as "nothing happened".
    try {
      await recordActivity(context, {
        action: 'delete',
        entityId: id,
        entityType: 'event',
      });
    } catch (error) {
      logger.warn('Failed to record the audit line of a deleted event', {
        error,
        eventId: id,
        requestId: context.requestId,
      });
    }

    logger.info('event deleted', {
      eventId: id,
      requestId: context.requestId,
    });

    return { id };
  });
