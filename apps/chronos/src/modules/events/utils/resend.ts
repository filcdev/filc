import { and, eq } from 'drizzle-orm';
import { db } from '#database';
import { event, eventRegistration, eventTicket } from '#modules/events/schema';
import { sendGuestTicket } from '#modules/events/utils/ticket-mail';

/**
 * Why a resend did nothing, or the ticket code it mailed. `not_found` covers
 * both a missing row and a registration that never had a ticket (a signed-in
 * student), because the caller cannot tell those apart and should not.
 */
export type TicketResendResult =
  | { code: string; ok: true }
  | { ok: false; reason: 'mail_failed' | 'not_found' };

/**
 * Re-sends the ticket of one guest registration, same code. The mail itself is
 * the whole point of the request, so a failed send is reported rather than
 * swallowed the way a registration's first ticket is.
 */
export const resendTicket = async (
  eventId: string,
  registrationId: string,
  requestId?: string
): Promise<TicketResendResult> => {
  const [row] = await db
    .select({
      code: eventTicket.id,
      guestEmail: eventRegistration.guestEmail,
      guestName: eventRegistration.guestName,
      startsAt: event.startsAt,
      title: event.title,
    })
    .from(eventRegistration)
    .innerJoin(event, eq(eventRegistration.eventId, event.id))
    .innerJoin(
      eventTicket,
      eq(eventTicket.registrationId, eventRegistration.id)
    )
    .where(
      and(
        eq(eventRegistration.id, registrationId),
        eq(eventRegistration.eventId, eventId)
      )
    );

  // A signed-in student has no ticket; nothing to resend.
  if (!(row?.guestEmail && row.guestName)) {
    return { ok: false, reason: 'not_found' };
  }

  const sent = await sendGuestTicket({
    code: row.code,
    email: row.guestEmail,
    eventId,
    eventStartsAt: row.startsAt,
    eventTitle: row.title,
    registrationId,
    requestId,
    visitorName: row.guestName,
  });

  return sent.ok
    ? { code: row.code, ok: true }
    : { ok: false, reason: 'mail_failed' };
};
