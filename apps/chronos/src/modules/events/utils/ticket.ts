import { getLogger } from '@logtape/logtape';
import { captureException } from '@sentry/bun';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { eventTicket } from '#modules/events/schema';
import type { TxOrDb } from '#modules/events/utils/registration-write';
import { sendTicket } from '#modules/events/utils/ticket-mail';
import { resolveTicketRecipient } from '#modules/events/utils/ticket-recipient';

const logger = getLogger(['chronos', 'events', 'tickets']);

/**
 * The one ticket of a registration, created on first use.
 *
 * The `unique(registration_id)` constraint is what makes this safe: a
 * registration has at most one ticket, and re-issuing mails the same code. A
 * guest gets theirs inside the signup transaction, a signed-in registrant after
 * it commits.
 */
export const ensureTicket = async (tx: TxOrDb, registrationId: string) => {
  const [existing] = await tx
    .select()
    .from(eventTicket)
    .where(eq(eventTicket.registrationId, registrationId));

  if (existing) {
    return existing;
  }

  const [created] = await tx
    .insert(eventTicket)
    .values({ registrationId })
    .returning();

  if (!created) {
    throw new Error('Failed to issue the event ticket');
  }

  return created;
};

/** Records that the ticket mail reached the transport; a failed send stays null. */
export const markTicketSent = async (
  tx: TxOrDb,
  ticketId: string
): Promise<void> => {
  await tx
    .update(eventTicket)
    .set({ sentAt: new Date() })
    .where(eq(eventTicket.id, ticketId));
};

/**
 * Issue the registration's ticket (if it has none) and mail it to whoever the
 * registration belongs to. Best effort: the registration is already committed,
 * so nothing here may throw and undo it.
 */
export const issueAndSendTicket = async (facts: {
  eventId: string;
  eventStartsAt: Date;
  eventTitle: string;
  registrationId: string;
  requestId?: string;
}): Promise<{ ok: boolean }> => {
  const { eventId, registrationId, requestId } = facts;

  try {
    const ticket = await ensureTicket(db, registrationId);
    const recipient = await resolveTicketRecipient(
      db,
      registrationId,
      requestId
    );

    if (!recipient) {
      return { ok: false };
    }

    const sent = await sendTicket({
      code: ticket.id,
      email: recipient.email,
      eventId,
      eventStartsAt: facts.eventStartsAt,
      eventTitle: facts.eventTitle,
      locale: recipient.locale,
      registrationId,
      requestId,
      visitorName: recipient.name,
    });

    if (sent.ok) {
      try {
        await markTicketSent(db, ticket.id);
      } catch (error) {
        // The mail is already gone; failing to record that must not report the
        // delivery as a failure, but it is worth a human.
        logger.error('failed to mark the event ticket as sent', {
          error,
          eventId,
          registrationId,
          requestId,
          ticketId: ticket.id,
        });
        captureException(error);
      }
    }

    return sent;
  } catch (error) {
    logger.error('failed to issue or send the event ticket', {
      error,
      eventId,
      registrationId,
      requestId,
    });
    captureException(error);
    return { ok: false };
  }
};
