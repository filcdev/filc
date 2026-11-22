import type { EventRegistrationAnswer } from '@filcdev/api/domains/events/registration';
import { getLogger } from '@logtape/logtape';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '#database';
import { recordActivity } from '#modules/activity-log/utils/record';
import { eventRegistration } from '#modules/events/schema';
import { checkAnswers } from '#modules/events/utils/answers';
import { guestEventFields } from '#modules/events/utils/events';
import {
  lockPublishedEvent,
  replaceAnswers,
  runWithFormRaceGuard,
  type TxOrDb,
} from '#modules/events/utils/registration-write';
import {
  type GuestRefusal,
  judgeGuestRegistration,
} from '#modules/events/utils/rules';
import { seatCount } from '#modules/events/utils/seats';
import { ensureTicket, markTicketSent } from '#modules/events/utils/ticket';
import { sendTicket } from '#modules/events/utils/ticket-mail';
import { base } from '#orpc';
import { badRequest, conflict } from '#utils/http';

const logger = getLogger(['chronos', 'events', 'guests']);

/** What a refused guest signup says. The reason stays the machine code. */
const GUEST_REFUSAL_MESSAGES: Record<GuestRefusal, string> = {
  closed: 'Registration has closed',
  duplicate_email: 'You have already registered for this event with this email',
  full: 'This event is full',
  guest_registration_disabled: 'This event does not take guest registrations',
  not_open_yet: 'Registration has not opened yet',
  registration_disabled: 'Registration is not open for this event',
};

const throwGuestRefusal = (reason: GuestRefusal): never => {
  const message = GUEST_REFUSAL_MESSAGES[reason];
  if (reason === 'full' || reason === 'duplicate_email') {
    throw conflict(message);
  }
  throw badRequest(message);
};

/**
 * The write half of a guest signup: the eligibility decision, the answers and
 * the ticket row, all inside the caller's transaction.
 */
const writeGuestRegistration = async (
  tx: TxOrDb,
  args: {
    address: string;
    answers: EventRegistrationAnswer[];
    emailKey: string;
    eventId: string;
    name: string;
    now: Date;
    requestId: string;
  }
) => {
  const { address, answers, emailKey, eventId, name, now, requestId } = args;
  const row = await lockPublishedEvent(tx, eventId);

  const [existing] = await tx
    .select()
    .from(eventRegistration)
    .where(
      and(
        eq(eventRegistration.eventId, eventId),
        sql`lower(${eventRegistration.guestEmail}) = ${emailKey}`
      )
    );

  const taken = await seatCount(eventId, tx);
  const decision = judgeGuestRegistration({
    capacity: row.capacity,
    duplicateEmail: existing?.status === 'confirmed',
    guestRegistrationEnabled: row.guestRegistrationEnabled,
    now,
    registrationClosesAt: row.registrationClosesAt,
    registrationEnabled: row.registrationEnabled,
    registrationOpensAt: row.registrationOpensAt,
    taken,
  });
  // Eligibility first: a closed or full event is the answer, before the form
  // the visitor filled in is judged.
  if (!decision.ok) {
    logger.info('guest registration refused', {
      eventId,
      reason: decision.reason,
      requestId,
    });
    throwGuestRefusal(decision.reason);
  }

  const fields = await guestEventFields(eventId, tx);
  const checked = checkAnswers(fields, answers);
  if (!checked.ok) {
    throw badRequest(checked.message);
  }

  const [saved] = existing
    ? // A cancelled guest keeps their row and their ticket; registering again
      // reactivates both, exactly like a student's row.
      await tx
        .update(eventRegistration)
        .set({
          guestEmail: address,
          guestName: name,
          role: 'visitor',
          status: 'confirmed',
        })
        .where(eq(eventRegistration.id, existing.id))
        .returning()
    : await tx
        .insert(eventRegistration)
        .values({
          eventId,
          guestEmail: address,
          guestName: name,
          // A visitor occupies a seat; only a helper does not.
          role: 'visitor',
          status: 'confirmed',
        })
        .returning();

  if (!saved) {
    throw new Error('Failed to save the guest registration');
  }

  await replaceAnswers(tx, saved.id, checked.answers);

  const issued = await ensureTicket(tx, saved.id);

  return {
    eventStartsAt: row.startsAt,
    eventTitle: row.title,
    reactivated: Boolean(existing),
    registration: saved,
    ticket: issued,
  };
};

/**
 * A visitor registers without an account and gets a ticket by email.
 *
 * Public on purpose. The event must be published and have guest signup on; the
 * seat, the window and the answers are re-checked inside the transaction that
 * takes the seat, so two parents racing for the last place produce one ticket.
 * The mail goes out after the commit and can never undo it.
 */
export const createGuestRegistration = base.events.guests.create.handler(
  async ({ context, input }) => {
    const { answers = [], email, id, name } = input;
    const now = new Date();
    const address = email.trim();
    // The unique guard is on `lower(guest_email)`, so the comparison is too.
    const emailKey = address.toLowerCase();
    const visitorName = name.trim();

    // Every attempt is on the record with the request that made it: this is a
    // public, unauthenticated write, and the rate limit lives in the global
    // middleware, not here.
    logger.info('guest registration attempt', {
      eventId: id,
      requestId: context.requestId,
    });

    const { eventStartsAt, eventTitle, reactivated, registration, ticket } =
      await runWithFormRaceGuard(() =>
        db.transaction((tx) =>
          writeGuestRegistration(tx, {
            address,
            answers,
            emailKey,
            eventId: id,
            name: visitorName,
            now,
            requestId: context.requestId,
          })
        )
      );

    await recordActivity(context, {
      action: reactivated ? 'update' : 'create',
      entityId: id,
      entityType: 'event',
      metadata: {
        after: { status: 'confirmed' },
        before: { status: reactivated ? 'cancelled' : null },
        registrationId: registration.id,
        role: 'visitor',
      },
    });

    // The row and the ticket are committed; the mail is best effort. A failure
    // is logged and reported inside `sendTicket`, which never throws.
    const sent = await sendTicket({
      code: ticket.id,
      email: address,
      eventId: id,
      eventStartsAt,
      eventTitle,
      registrationId: registration.id,
      requestId: context.requestId,
      visitorName,
    });

    if (sent.ok) {
      try {
        await markTicketSent(db, ticket.id);
      } catch (error) {
        logger.error('failed to mark the guest ticket as sent', {
          error,
          eventId: id,
          registrationId: registration.id,
          requestId: context.requestId,
          ticketId: ticket.id,
        });
      }
    }

    logger.info('guest registration created', {
      delivered: sent.ok,
      eventId: id,
      reactivated,
      registrationId: registration.id,
      requestId: context.requestId,
    });

    return { code: ticket.id, registrationId: registration.id };
  }
);
