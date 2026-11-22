import { getLogger } from '@logtape/logtape';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '#database';
import { event, eventRegistration } from '#modules/events/schema';
import { ensureTicket, markTicketSent } from '#modules/events/utils/ticket';
import { sendTicket } from '#modules/events/utils/ticket-mail';
import { resolveTicketRecipient } from '#modules/events/utils/ticket-recipient';

const logger = getLogger(['chronos', 'events', 'tickets']);

/**
 * Why a resend did nothing, or the ticket code it mailed. `not_found` covers a
 * registration that does not exist and one that was cancelled: the caller
 * cannot tell those apart and should not.
 */
export type TicketResendResult =
  | { code: string; ok: true }
  | { ok: false; reason: 'mail_failed' | 'not_found' };

/**
 * Re-sends the ticket of one registration, same code. A guest, a student and a
 * helper all have one, so the admin can mail any of them again. The mail itself
 * is the whole point of the request, so a failed send is reported rather than
 * swallowed the way a registration's first ticket is.
 */
export const resendTicket = async (
  eventId: string,
  registrationId: string,
  requestId?: string
): Promise<TicketResendResult> => {
  const [row] = await db
    .select({
      startsAt: event.startsAt,
      title: event.title,
    })
    .from(eventRegistration)
    .innerJoin(event, eq(eventRegistration.eventId, event.id))
    .where(
      and(
        eq(eventRegistration.id, registrationId),
        eq(eventRegistration.eventId, eventId),
        ne(eventRegistration.status, 'cancelled')
      )
    );

  if (!row) {
    return { ok: false, reason: 'not_found' };
  }

  const recipient = await resolveTicketRecipient(db, registrationId, requestId);
  if (!recipient) {
    return { ok: false, reason: 'not_found' };
  }

  // A confirmed registration issued its ticket when it was confirmed; this is
  // the backstop for a row written before tickets were role-agnostic.
  const ticket = await ensureTicket(db, registrationId);

  const sent = await sendTicket({
    code: ticket.id,
    email: recipient.email,
    eventId,
    eventStartsAt: row.startsAt,
    eventTitle: row.title,
    locale: recipient.locale,
    registrationId,
    requestId,
    visitorName: recipient.name,
  });

  if (!sent.ok) {
    return { ok: false, reason: 'mail_failed' };
  }

  try {
    await markTicketSent(db, ticket.id);
  } catch (error) {
    logger.error('failed to mark the resent event ticket as sent', {
      error,
      eventId,
      registrationId,
      requestId,
      ticketId: ticket.id,
    });
  }

  return { code: ticket.id, ok: true };
};
