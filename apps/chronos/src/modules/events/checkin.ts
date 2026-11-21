import { getLogger } from '@logtape/logtape';
import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthentication } from '#middleware/auth';
import { recordActivity } from '#modules/activity-log/utils/record';
import {
  event,
  eventField,
  eventRegistration,
  eventRegistrationAnswer,
  eventTicket,
} from '#modules/events/schema';
import {
  type CheckinStore,
  type CheckinTicket,
  checkInTicket,
} from '#modules/events/utils/checkin';
import { requireEventCheckin } from '#modules/events/utils/checkin-access';
import { base } from '#orpc';

const logger = getLogger(['chronos', 'events', 'checkin']);

/**
 * A uuid, checked before the query: Postgres rejects any other string with a
 * type error, and a hand-typed code is ordinary input at the door. A code that
 * cannot be a ticket is answered as `not_found`, never as a 400.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Two references to `user` in one query: the registrant and the scanner. */
const registrant = alias(user, 'registrant');
const scanner = alias(user, 'scanner');

/**
 * The ticket with everything the decision and the door panel need.
 *
 * One query, joined rather than four lookups: the door is a latency-sensitive
 * place, and the row is small. A guest keeps their name and address on the
 * registration; a signed-in student has none, so the account is joined as the
 * fallback. The scanner is joined for the "who let them in" of a repeat scan.
 */
/**
 * Every answer of one registration, with the question's own label and type. The
 * type is what lets the rule evaluator compare numbers and checkboxes correctly,
 * and what the details panel renders as a tick.
 */
const findAnswers = async (
  registrationId: string
): Promise<CheckinTicket['answers']> =>
  db
    .select({
      fieldId: eventField.id,
      label: eventField.label,
      type: eventField.type,
      value: eventRegistrationAnswer.value,
    })
    .from(eventRegistrationAnswer)
    .innerJoin(eventField, eq(eventRegistrationAnswer.fieldId, eventField.id))
    .where(eq(eventRegistrationAnswer.registrationId, registrationId))
    .orderBy(eventField.position, eventField.id);

const findTicket = async (code: string): Promise<CheckinTicket | null> => {
  const [row] = await db
    .select({
      checkedInAt: eventTicket.checkedInAt,
      checkedInByName: scanner.name,
      eventId: eventRegistration.eventId,
      guestEmail: eventRegistration.guestEmail,
      guestName: eventRegistration.guestName,
      registrationId: eventRegistration.id,
      registrationStatus: eventRegistration.status,
      studentEmail: registrant.email,
      studentName: registrant.name,
      ticketId: eventTicket.id,
    })
    .from(eventTicket)
    .innerJoin(
      eventRegistration,
      eq(eventTicket.registrationId, eventRegistration.id)
    )
    .leftJoin(registrant, eq(eventRegistration.userId, registrant.id))
    .leftJoin(scanner, eq(eventTicket.checkedInBy, scanner.id))
    .where(eq(eventTicket.id, code));

  if (!row) {
    return null;
  }

  // A second read only for a ticket that exists: the door's common miss is an
  // unknown code, and that path never pays for the answer query.
  const answers = await findAnswers(row.registrationId);

  return {
    answers,
    checkedInAt: row.checkedInAt,
    checkedInByName: row.checkedInByName,
    eventId: row.eventId,
    registrationId: row.registrationId,
    registrationStatus: row.registrationStatus,
    ticketId: row.ticketId,
    // A ticket is issued per registration, so one of the two is always there;
    // the empty string is the schema's non-null answer for a half-written row.
    visitorEmail: row.guestEmail ?? row.studentEmail ?? '',
    visitorName: row.guestName ?? row.studentName ?? '',
  };
};

/** Writes the first check-in only, so a repeat scan cannot move the time. */
const markCheckedIn = async (
  ticketId: string,
  userId: string,
  at: Date
): Promise<boolean> => {
  const [row] = await db
    .update(eventTicket)
    .set({ checkedInAt: at, checkedInBy: userId })
    .where(and(eq(eventTicket.id, ticketId), isNull(eventTicket.checkedInAt)))
    .returning({ id: eventTicket.id });
  return Boolean(row);
};

const store: CheckinStore = { findTicket, markCheckedIn };

/**
 * The door scan.
 *
 * The QR payload is the ticket id, so it is a credential: the log carries the
 * ids and the outcome and never the scanned code, the visitor's email or name.
 * Only a first check-in is an audited write; scanning an already admitted
 * ticket, a cancelled one or nonsense changes nothing.
 */
export const checkInTicketAtDoor = base.events.checkin
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const { code, id } = input;
    const now = new Date();

    // The global permission is not required: an approved helper's grant is
    // enough, but only for this event. The check reads the clock here, so an
    // expired grant is refused before a cleanup job ever runs.
    await requireEventCheckin(context.session.userId, id, now);

    // The event's own rules decide both what the scanner may reveal and
    // whether entry is granted. Read here, on the server, so the client never
    // receives a field a rule hid — a cancelled ticket is reduced the same way.
    const [eventRow] = await db
      .select({ checkinRules: event.checkinRules })
      .from(event)
      .where(eq(event.id, id));

    if (!eventRow) {
      return { status: 'not_found' as const };
    }

    logger.debug('check-in scanned', {
      eventId: id,
      requestId: context.requestId,
      ruleCount: eventRow.checkinRules.length,
    });

    const result = UUID.test(code)
      ? await checkInTicket(store, {
          code,
          eventId: id,
          now,
          rules: eventRow.checkinRules,
          userId: context.session.userId,
        })
      : { status: 'not_found' as const };

    logger.info('check-in resolved', {
      eventId: id,
      outcome: result.status,
      // Not the code: the ticket id is the QR payload, and this line is not a
      // way to learn one.
      registrationId:
        result.status === 'not_found' ? null : result.registrationId,
      requestId: context.requestId,
      userId: context.session.userId,
    });

    if (result.status === 'admitted') {
      await recordActivity(context, {
        action: 'update',
        entityId: id,
        entityType: 'event',
        metadata: {
          after: { checkedInAt: now },
          registrationId: result.registrationId,
        },
      });
    }

    if (result.status === 'invalid') {
      // A cancelled place at the door is recoverable but worth seeing in the
      // log: someone turned up who is not expected.
      logger.warning('check-in refused: registration cancelled', {
        eventId: id,
        registrationId: result.registrationId,
        requestId: context.requestId,
      });
    }

    if (result.status === 'not_granted') {
      // A rule denied entry. The message is the organizer's wording for the
      // scanner, not a substitute for the log line.
      logger.warning('check-in denied by a door rule', {
        eventId: id,
        registrationId: result.registrationId,
        requestId: context.requestId,
      });
    }

    return result;
  });
