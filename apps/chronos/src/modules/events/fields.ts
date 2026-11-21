import type { EventFieldInput } from '@filcdev/api/domains/events/fields';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { recordActivity } from '#modules/activity-log/utils/record';
import {
  event,
  eventField,
  eventRegistrationAnswer,
} from '#modules/events/schema';
import { pruneCheckinRules } from '#modules/events/utils/door-rules';
import { base } from '#orpc';
import { badRequest, conflict, notFound } from '#utils/http';
import { diffActivity, valuesEqual } from '#utils/values';

const logger = getLogger(['chronos', 'events']);

type Tx = Parameters<Parameters<(typeof db)['transaction']>[0]>[0];

/** A select without choices cannot be answered. */
function assertSelectsHaveChoices(fields: EventFieldInput[]): void {
  for (const field of fields) {
    if (
      field.type === 'select' &&
      !(field.options && field.options.length > 0)
    ) {
      throw badRequest(
        `The select question "${field.label}" needs at least one option`
      );
    }
  }
}

/** The ids the payload keeps; every one must belong to this event, once. */
function collectKeptFieldIds(
  fields: EventFieldInput[],
  existingIds: Set<string>
): Set<string> {
  const keptIds = new Set<string>();
  for (const field of fields) {
    if (!field.id) {
      continue;
    }
    if (!existingIds.has(field.id)) {
      throw badRequest(
        'A question in the payload does not belong to this event'
      );
    }
    if (keptIds.has(field.id)) {
      throw badRequest(`The question id ${field.id} appears more than once`);
    }
    keptIds.add(field.id);
  }
  return keptIds;
}

async function writeField(
  tx: Tx,
  eventId: string,
  field: EventFieldInput
): Promise<void> {
  const values = {
    audiences: field.audiences,
    label: field.label,
    options: field.type === 'select' ? (field.options ?? null) : null,
    position: field.position,
    required: field.required,
    type: field.type,
  };

  if (field.id) {
    // Scoped by the event too, so the row this writes is the one the caller
    // was authorised for even if an id ever slipped past the check above.
    await tx
      .update(eventField)
      .set(values)
      .where(and(eq(eventField.eventId, eventId), eq(eventField.id, field.id)));
    return;
  }

  await tx.insert(eventField).values({ ...values, eventId });
}

/**
 * Replace an event's custom question set in one transaction. As with rooms, a
 * question carried with an `id` keeps its row — and therefore the answers
 * already attached to it. An omitted question is deleted only while nobody has
 * answered it; once it has answers, removing it is a conflict.
 */
export const replaceEventFields = base.events.fields.replace
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const { fields, id } = input;

    assertSelectsHaveChoices(fields);

    const { replaced, before } = await db.transaction(async (tx) => {
      // The same row lock the registration paths take: without it a question
      // could be deleted between a form read and the answer insert, which is a
      // foreign-key violation (23503) rather than the conflict it is.
      const [locked] = await tx
        .select({
          checkinRules: event.checkinRules,
          id: event.id,
        })
        .from(event)
        .where(eq(event.id, id))
        .for('update');
      if (!locked) {
        throw notFound('Event not found');
      }

      const existingFields = await tx
        .select()
        .from(eventField)
        .where(eq(eventField.eventId, id))
        .orderBy(eventField.position);
      const existingIds = new Set(existingFields.map((field) => field.id));
      const keptIds = collectKeptFieldIds(fields, existingIds);
      const removed = [...existingIds].filter(
        (fieldId) => !keptIds.has(fieldId)
      );

      if (removed.length > 0) {
        // Answers cascade with their question, so removing one would delete
        // what a registration already submitted. Name the question instead.
        const [answered] = await tx
          .select({ label: eventField.label })
          .from(eventRegistrationAnswer)
          .innerJoin(
            eventField,
            eq(eventRegistrationAnswer.fieldId, eventField.id)
          )
          .where(inArray(eventRegistrationAnswer.fieldId, removed))
          .limit(1);
        if (answered) {
          throw conflict(
            `The question "${answered.label}" already has answers and cannot be removed`
          );
        }

        await tx.delete(eventField).where(inArray(eventField.id, removed));
      }

      for (const field of fields) {
        await writeField(tx, id, field);
      }

      const rows = await tx
        .select()
        .from(eventField)
        .where(eq(eventField.eventId, id))
        .orderBy(eventField.position);

      // A door rule can only point at a question this event still has, so a
      // removed question is pruned inside the same transaction: a rule that
      // named it goes, and a rule that showed it stops showing it. No later scan
      // can then evaluate a condition whose field no longer exists.
      const keptFieldIds = new Set(rows.map((field) => field.id));
      const prunedCheckinRules = pruneCheckinRules(
        locked.checkinRules,
        keptFieldIds
      );
      if (!valuesEqual(prunedCheckinRules, locked.checkinRules)) {
        await tx
          .update(event)
          .set({ checkinRules: prunedCheckinRules })
          .where(eq(event.id, id));
      }

      return { before: existingFields, replaced: rows };
    });

    const diff = diffActivity({}, {}, [], {
      after: { fields: replaced },
      before: { fields: before },
    });
    if (diff) {
      await recordActivity(context, {
        action: 'update',
        entityId: id,
        entityType: 'event',
        metadata: diff,
      });
    }

    logger.info('event questions replaced', {
      count: replaced.length,
      eventId: id,
      requestId: context.requestId,
    });

    return { items: replaced, total: replaced.length };
  });
