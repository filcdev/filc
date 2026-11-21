import type { EventRegistrationAnswer } from '@filcdev/api/domains/events/registration';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { and, eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { recordActivity } from '#modules/activity-log/utils/record';
import { eventRegistration } from '#modules/events/schema';
import { checkAnswers } from '#modules/events/utils/answers';
import { decidePendingRegistration } from '#modules/events/utils/decision';
import {
  canManageEvents,
  resolveEventViewer,
  studentEventFields,
} from '#modules/events/utils/events';
import {
  lockPublishedEvent,
  replaceAnswers,
  runWithFormRaceGuard,
  type TxOrDb,
} from '#modules/events/utils/registration-write';
import { resendTicket } from '#modules/events/utils/resend';
import {
  judgeHelperRegistration,
  judgeRegistration,
  type RegistrationDecision,
  type RegistrationFacts,
  type RegistrationRefusal,
} from '#modules/events/utils/rules';
import { seatCount } from '#modules/events/utils/seats';
import { base } from '#orpc';
import {
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
} from '#utils/http';

const logger = getLogger(['chronos', 'events', 'registrations']);

/** What a refused registration says. The reason stays the machine-readable code. */
const REFUSAL_MESSAGES: Record<RegistrationRefusal, string> = {
  already_registered: 'You are already registered for this event',
  closed: 'Registration has closed',
  full: 'This event is full',
  grade_too_high: 'This event is for lower grades',
  grade_too_low: 'This event is for higher grades',
  grade_unknown:
    'Your class does not name a grade, so this event cannot judge it',
  helper_registration_disabled: 'This event does not take helper signups',
  not_open_yet: 'Registration has not opened yet',
  pending_approval: 'Your registration is waiting for approval',
  registration_disabled: 'Registration is not open for this event',
  wrong_cohort: 'This event is not open to your class',
};

const throwRefusal = (decision: RegistrationDecision): void => {
  if (decision.ok) {
    return;
  }
  const message = REFUSAL_MESSAGES[decision.reason];
  // Losing a race for the last seat and double-submitting are conflicts; the
  // rest are the request asking for something the event never allows.
  if (
    decision.reason === 'full' ||
    decision.reason === 'already_registered' ||
    decision.reason === 'pending_approval'
  ) {
    throw conflict(message);
  }
  throw badRequest(message);
};

const findRegistration = async (
  tx: TxOrDb,
  eventId: string,
  userId: string
) => {
  const [row] = await tx
    .select()
    .from(eventRegistration)
    .where(
      and(
        eq(eventRegistration.eventId, eventId),
        eq(eventRegistration.userId, userId)
      )
    );
  return row ?? null;
};

/** Reactivates the caller's cancelled row, or inserts the first one. */
const storeRegistration = async (
  tx: TxOrDb,
  args: {
    answers: EventRegistrationAnswer[];
    eventId: string;
    existing: typeof eventRegistration.$inferSelect | null;
    role: 'helper' | 'participant';
    status: 'confirmed' | 'pending';
    userId: string;
  }
) => {
  const [saved] = args.existing
    ? await tx
        .update(eventRegistration)
        .set({ role: args.role, status: args.status })
        .where(eq(eventRegistration.id, args.existing.id))
        .returning()
    : await tx
        .insert(eventRegistration)
        .values({
          eventId: args.eventId,
          role: args.role,
          status: args.status,
          userId: args.userId,
        })
        .returning();

  if (!saved) {
    throw new Error('Failed to save the registration');
  }

  await replaceAnswers(tx, saved.id, args.answers);

  return saved;
};

export const createRegistration = base.events.registrations.create
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const { answers = [], id, role } = input;
    const userId = context.session.userId;
    const now = new Date();
    const isHelper = role === 'helper';
    // Who the caller is does not change mid-request, so this is read once and
    // handed to the rules under the lock.
    const viewer = await resolveEventViewer(userId);

    const { beforeRole, beforeStatus, reactivated, registration } =
      await runWithFormRaceGuard(() =>
        db.transaction(async (tx) => {
          const row = await lockPublishedEvent(tx, id);

          const existing = await findRegistration(tx, id, userId);
          const pending = existing?.status === 'pending';
          const registered = existing?.status === 'confirmed';

          // Eligibility first: a caller the event does not admit is told so, not
          // sent back to fix a form they could not submit anyway. A helper is
          // judged by its own switches and window; a participant by seats, cohort
          // and grade.
          if (isHelper) {
            throwRefusal(
              judgeHelperRegistration({
                helperRegistrationClosesAt: row.helperRegistrationClosesAt,
                helperRegistrationEnabled: row.helperRegistrationEnabled,
                helperRegistrationOpensAt: row.helperRegistrationOpensAt,
                helperRegistrationSeparateWindow:
                  row.helperRegistrationSeparateWindow,
                now,
                pending,
                registered,
                registrationClosesAt: row.registrationClosesAt,
                registrationEnabled: row.registrationEnabled,
                registrationOpensAt: row.registrationOpensAt,
              })
            );
          } else {
            const facts: RegistrationFacts = {
              capacity: row.capacity,
              cohortIds: row.cohortIds,
              grade: viewer.grade,
              maxGrade: row.maxGrade,
              minGrade: row.minGrade,
              now,
              pending,
              registered,
              registrationClosesAt: row.registrationClosesAt,
              registrationEnabled: row.registrationEnabled,
              registrationOpensAt: row.registrationOpensAt,
              taken: await seatCount(id, tx),
              viewerCohortId: viewer.cohortId,
            };
            throwRefusal(judgeRegistration(facts));
          }

          const fields = await studentEventFields(id, tx);
          const checked = checkAnswers(fields, answers);
          if (!checked.ok) {
            throw badRequest(checked.message);
          }

          // A helper signup always waits for the organizer; a participant is
          // confirmed at once. Helpers never take a seat either way.
          const saved = await storeRegistration(tx, {
            answers: checked.answers,
            eventId: id,
            existing,
            role,
            status: isHelper ? 'pending' : 'confirmed',
            userId,
          });

          return {
            beforeRole: existing?.role ?? null,
            beforeStatus: existing?.status ?? null,
            reactivated: Boolean(existing),
            registration: { ...saved, answers: checked.answers },
          };
        })
      );

    await recordActivity(context, {
      action: reactivated ? 'update' : 'create',
      entityId: id,
      entityType: 'event',
      metadata: {
        after: { role, status: registration.status },
        before: { role: beforeRole, status: beforeStatus },
        registrationId: registration.id,
      },
    });

    logger.info('event registration created', {
      eventId: id,
      reactivated,
      registrationId: registration.id,
      requestId: context.requestId,
      role: registration.role,
      status: registration.status,
      userId,
    });

    return registration;
  });

export const cancelRegistration = base.events.registrations.cancel
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const { id, registrationId } = input;
    const userId = context.session.userId;

    // A student cancels their own row only, where someone else's id is
    // indistinguishable from a missing one. An organizer may cancel any row of
    // the event — that is the participant table's cancel action.
    const canManage = await canManageEvents(userId);

    const [cancelled] = await db
      .update(eventRegistration)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(eventRegistration.id, registrationId),
          eq(eventRegistration.eventId, id),
          eq(eventRegistration.status, 'confirmed'),
          canManage ? undefined : eq(eventRegistration.userId, userId)
        )
      )
      .returning();

    if (!cancelled) {
      throw notFound('Registration not found');
    }

    await recordActivity(context, {
      action: 'update',
      entityId: id,
      entityType: 'event',
      metadata: {
        after: { status: 'cancelled' },
        before: { status: 'confirmed' },
        registrationId: cancelled.id,
      },
    });

    logger.info('event registration cancelled', {
      byOrganizer: canManage,
      eventId: id,
      registrationId: cancelled.id,
      requestId: context.requestId,
      userId,
    });

    return { id: cancelled.id };
  });

/**
 * The organizer's answer to a pending helper signup. Approving confirms the
 * row, declining cancels it; both are audited. The row lock and the status
 * predicate inside `decidePendingRegistration` make a second answer a 409.
 */
export const decideRegistration = base.events.registrations.decide
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const registration = await db.transaction((tx) =>
      decidePendingRegistration(tx, input)
    );

    await recordActivity(context, {
      action: 'update',
      entityId: input.id,
      entityType: 'event',
      metadata: {
        after: { status: registration.status },
        before: { status: 'pending' },
        decision: input.decision,
        registrationId: registration.id,
        role: registration.role,
      },
    });

    logger.info('event registration decided', {
      decision: input.decision,
      eventId: input.id,
      registrationId: registration.id,
      requestId: context.requestId,
      role: registration.role,
      status: registration.status,
    });

    return registration;
  });

export const resendRegistrationTicket = base.events.registrations.resend
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const { id, registrationId } = input;

    const result = await resendTicket(id, registrationId, context.requestId);

    if (!result.ok) {
      if (result.reason === 'not_found') {
        throw notFound('This registration has no ticket');
      }
      // The mail is the whole point of the request, so a failed send is the
      // answer: the admin can retry instead of assuming the parent got it.
      // `sendGuestTicket` has already logged and reported the failure; this
      // line ties it to the request the admin made.
      logger.error('guest ticket resend failed', {
        eventId: id,
        registrationId,
        requestId: context.requestId,
      });
      throw serviceUnavailable('The ticket email could not be sent');
    }

    logger.info('guest ticket resent', {
      eventId: id,
      registrationId,
      requestId: context.requestId,
    });

    return { id: result.code };
  });
