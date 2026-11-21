import type { EventRegistrationAnswer } from '@filcdev/api/domains/events/registration';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { recordActivity } from '#modules/activity-log/utils/record';
import { event, eventRegistration } from '#modules/events/schema';
import { checkAnswers } from '#modules/events/utils/answers';
import { decidePendingRegistration } from '#modules/events/utils/decision';
import {
  canManageEvents,
  type EventViewer,
  resolveEventViewer,
  studentEventFields,
} from '#modules/events/utils/events';
import { revokeCheckinGrant } from '#modules/events/utils/grant';
import {
  lockPublishedEvent,
  replaceAnswers,
  runWithFormRaceGuard,
  type TxOrDb,
} from '#modules/events/utils/registration-write';
import { resendTicket } from '#modules/events/utils/resend';
import {
  type eventRooms,
  resolveChosenRoom,
  roomSeatCount,
} from '#modules/events/utils/rooms';
import {
  judgeHelperRegistration,
  judgeRegistration,
  type RegistrationDecision,
  type RegistrationFacts,
  type RegistrationRefusal,
} from '#modules/events/utils/rules';
import { seatCount } from '#modules/events/utils/seats';
import { issueAndSendTicket } from '#modules/events/utils/ticket';
import { base } from '#orpc';
import {
  badRequest,
  conflict,
  notFound,
  roomFull,
  roomRequired,
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
  room_full: 'The chosen room is full',
  room_required: 'Choose a room for this event',
  wrong_cohort: 'This event is not open to your class',
};

const throwRefusal = (decision: RegistrationDecision): void => {
  if (decision.ok) {
    return;
  }
  const message = REFUSAL_MESSAGES[decision.reason];
  // A room problem keeps its own code so the client can say which limit was
  // hit — the event's or the chosen room's — instead of one "full" message.
  if (decision.reason === 'room_required') {
    throw roomRequired(message);
  }
  if (decision.reason === 'room_full') {
    throw roomFull(message);
  }
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

/**
 * The event facts a ticket mail needs, read after the registration commits so
 * the write path does not carry them. A missing event is impossible while the
 * registration exists; answering null keeps the best-effort mail from taking a
 * registration down over a title.
 */
const ticketEventFacts = async (eventId: string, requestId: string) => {
  const [row] = await db
    .select({ startsAt: event.startsAt, title: event.title })
    .from(event)
    .where(eq(event.id, eventId));

  if (!row) {
    logger.error('registration has no event to issue a ticket for', {
      eventId,
      requestId,
    });
    return null;
  }

  return { eventStartsAt: row.startsAt, eventTitle: row.title };
};

/** Reactivates the caller's cancelled row, or inserts the first one. */
const storeRegistration = async (
  tx: TxOrDb,
  args: {
    answers: EventRegistrationAnswer[];
    eventId: string;
    existing: typeof eventRegistration.$inferSelect | null;
    role: 'helper' | 'participant';
    roomId: string | null;
    status: 'confirmed' | 'pending';
    userId: string;
  }
) => {
  const [saved] = args.existing
    ? await tx
        .update(eventRegistration)
        .set({ role: args.role, roomId: args.roomId, status: args.status })
        .where(eq(eventRegistration.id, args.existing.id))
        .returning()
    : await tx
        .insert(eventRegistration)
        .values({
          eventId: args.eventId,
          role: args.role,
          roomId: args.roomId,
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

type EventRow = Awaited<ReturnType<typeof lockPublishedEvent>>;
type RoomRow = Awaited<ReturnType<typeof eventRooms>>[number];

type StudentRegistrationWrite = {
  answers: EventRegistrationAnswer[];
  eventId: string;
  isHelper: boolean;
  now: Date;
  roomId: string | undefined;
  userId: string;
  viewer: EventViewer;
};

/**
 * Eligibility is answered before the form: a caller the event does not admit is
 * told so, not sent back to fix a form they could not submit anyway. A helper is
 * judged by its own switches, window and grade band; a participant by seats,
 * cohort, grade and its chosen room.
 */
const judgeStudentEligibility = async (
  tx: TxOrDb,
  args: StudentRegistrationWrite,
  row: EventRow,
  existing: typeof eventRegistration.$inferSelect | null,
  chosenRoom: RoomRow | null,
  rooms: readonly RoomRow[]
): Promise<void> => {
  const pending = existing?.status === 'pending';
  const registered = existing?.status === 'confirmed';

  if (args.isHelper) {
    throwRefusal(
      judgeHelperRegistration({
        grade: args.viewer.grade,
        helperMaxGrade: row.helperMaxGrade,
        helperMinGrade: row.helperMinGrade,
        helperRegistrationClosesAt: row.helperRegistrationClosesAt,
        helperRegistrationEnabled: row.helperRegistrationEnabled,
        helperRegistrationOpensAt: row.helperRegistrationOpensAt,
        helperRegistrationSeparateWindow: row.helperRegistrationSeparateWindow,
        maxGrade: row.maxGrade,
        minGrade: row.minGrade,
        now: args.now,
        pending,
        registered,
        registrationClosesAt: row.registrationClosesAt,
        registrationEnabled: row.registrationEnabled,
        registrationOpensAt: row.registrationOpensAt,
      })
    );
    return;
  }

  const facts: RegistrationFacts = {
    capacity: row.capacity,
    cohortIds: row.cohortIds,
    grade: args.viewer.grade,
    maxGrade: row.maxGrade,
    minGrade: row.minGrade,
    now: args.now,
    pending,
    registered,
    registrationClosesAt: row.registrationClosesAt,
    registrationEnabled: row.registrationEnabled,
    registrationOpensAt: row.registrationOpensAt,
    roomCapacity: chosenRoom?.capacity ?? null,
    roomRequired: rooms.length > 0,
    roomTaken: chosenRoom ? await roomSeatCount(chosenRoom.id, tx) : 0,
    taken: await seatCount(args.eventId, tx),
    viewerCohortId: args.viewer.cohortId,
  };
  throwRefusal(judgeRegistration(facts));
};

/**
 * The whole write half of a student signup, under the event lock: the row, its
 * form, the room choice and the seat checks all read the same transaction, so
 * the judgement and the insert cannot disagree.
 */
const writeStudentRegistration = async (
  tx: TxOrDb,
  args: StudentRegistrationWrite
) => {
  const row = await lockPublishedEvent(tx, args.eventId);
  const existing = await findRegistration(tx, args.eventId, args.userId);
  const fields = await studentEventFields(args.eventId, tx);
  const { chosenRoom, rooms } = await resolveChosenRoom(
    args.eventId,
    args.roomId,
    tx
  );

  await judgeStudentEligibility(tx, args, row, existing, chosenRoom, rooms);

  const checked = checkAnswers(fields, args.answers);
  if (!checked.ok) {
    throw badRequest(checked.message);
  }

  // A helper takes no seat, so a room id they happen to send is never stored:
  // only a participant fills a room's place.
  const roomId = args.isHelper ? null : (chosenRoom?.id ?? null);
  const saved = await storeRegistration(tx, {
    answers: checked.answers,
    eventId: args.eventId,
    existing,
    role: args.isHelper ? 'helper' : 'participant',
    roomId,
    status: args.isHelper ? 'pending' : 'confirmed',
    userId: args.userId,
  });

  return {
    beforeRole: existing?.role ?? null,
    beforeStatus: existing?.status ?? null,
    reactivated: Boolean(existing),
    registration: {
      ...saved,
      answers: checked.answers,
      room: roomId ? { id: roomId, name: chosenRoom?.name ?? '' } : null,
    },
  };
};

export const createRegistration = base.events.registrations.create
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const { answers = [], id, role } = input;
    const userId = context.session.userId;
    const isHelper = role === 'helper';
    // Who the caller is does not change mid-request, so this is read once and
    // handed to the rules under the lock.
    const viewer = await resolveEventViewer(userId);

    const { beforeRole, beforeStatus, reactivated, registration } =
      await runWithFormRaceGuard(() =>
        db.transaction((tx) =>
          writeStudentRegistration(tx, {
            answers,
            eventId: id,
            isHelper,
            now: new Date(),
            roomId: input.roomId,
            userId,
            viewer,
          })
        )
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

    // A confirmed participant gets their QR ticket at once; a helper's row is
    // pending until an organizer approves it. The row is committed, so the
    // ticket and the mail are best effort and can never undo the registration.
    if (registration.status === 'confirmed') {
      const facts = await ticketEventFacts(id, context.requestId);
      if (facts) {
        await issueAndSendTicket({
          eventId: id,
          ...facts,
          registrationId: registration.id,
          requestId: context.requestId,
        });
      }
    }

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
    // indistinguishable from a missing one. An organizer may also cancel any
    // confirmed row of the event — the participant table's cancel action — but
    // a pending application is answered through the decision endpoint.
    const canManage = await canManageEvents(userId);

    // The status the row held before the update: only needed for the audit
    // metadata, and read before the write because RETURNING cannot see it.
    const [before] = await db
      .select({ status: eventRegistration.status })
      .from(eventRegistration)
      .where(
        and(
          eq(eventRegistration.id, registrationId),
          eq(eventRegistration.eventId, id)
        )
      );

    // The owner branch comes first: an admin who signed up as a helper must
    // still be able to withdraw their own pending application. The manager
    // branch covers everyone else's confirmed rows only — a pending row is the
    // decide endpoint's, not this one's.
    const ownership = and(
      eq(eventRegistration.userId, userId),
      // A pending helper may withdraw their own application; a cancelled row
      // stays cancelled, so a second cancel is a 404.
      inArray(eventRegistration.status, ['confirmed', 'pending'])
    );

    // The cancellation and the grant it revokes move together: leaving an
    // approved helper with a live grant after a withdrawal would let them scan
    // into an event they are no longer signed up for.
    const cancelled = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(eventRegistration)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(eventRegistration.id, registrationId),
            eq(eventRegistration.eventId, id),
            or(
              ownership,
              canManage ? eq(eventRegistration.status, 'confirmed') : undefined
            )
          )
        )
        .returning();

      if (row?.userId) {
        await revokeCheckinGrant(tx, { eventId: id, userId: row.userId });
      }

      return row ?? null;
    });

    if (!cancelled) {
      throw notFound('Registration not found');
    }

    await recordActivity(context, {
      action: 'update',
      entityId: id,
      entityType: 'event',
      metadata: {
        after: { status: 'cancelled' },
        before: { status: before?.status ?? null },
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
 * Ends an approved helper's door access before its natural expiry. The
 * registration stays confirmed — they are still expected at the event — only
 * the scanner grant goes away.
 */
export const revokeRegistrationCheckinGrant =
  base.events.registrations.revokeCheckinGrant
    .use(requireAuthorization(permissions.eventsManage))
    .handler(async ({ context, input }) => {
      const { id, registrationId } = input;

      const [registration] = await db
        .select({ userId: eventRegistration.userId })
        .from(eventRegistration)
        .where(
          and(
            eq(eventRegistration.id, registrationId),
            eq(eventRegistration.eventId, id)
          )
        );

      if (!registration) {
        throw notFound('Registration not found');
      }

      if (registration.userId) {
        await revokeCheckinGrant(db, {
          eventId: id,
          userId: registration.userId,
        });
        logger.info('event check-in grant revoked', {
          eventId: id,
          registrationId,
          requestId: context.requestId,
          userId: registration.userId,
        });
      }

      return { id: registrationId };
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

    // An approval that confirms a helper issues their ticket and mails it, the
    // same best-effort way a participant's is sent at signup. A decline mails
    // nothing: they are not coming.
    if (input.decision === 'approve') {
      const facts = await ticketEventFacts(input.id, context.requestId);
      if (facts) {
        await issueAndSendTicket({
          eventId: input.id,
          ...facts,
          registrationId: registration.id,
          requestId: context.requestId,
        });
      }
    }

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
      // `sendTicket` has already logged and reported the failure; this
      // line ties it to the request the admin made.
      logger.error('ticket resend failed', {
        eventId: id,
        registrationId,
        requestId: context.requestId,
      });
      throw serviceUnavailable('The ticket email could not be sent');
    }

    logger.info('ticket resent', {
      eventId: id,
      registrationId,
      requestId: context.requestId,
    });

    return { id: result.code };
  });
