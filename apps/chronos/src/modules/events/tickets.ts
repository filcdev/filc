import { getLogger } from '@logtape/logtape';
import { and, eq } from 'drizzle-orm';
import { db } from '#database';
import { event, eventRegistration, eventTicket } from '#modules/events/schema';
import { base } from '#orpc';
import { notFound } from '#utils/http';

const logger = getLogger(['chronos', 'events', 'tickets']);

/**
 * The public ticket read: what the door needs and nothing else.
 *
 * No answers and no email on purpose — anyone holding the link can read this.
 * A ticket of a draft event, or of a row that is not a visitor, answers 404 so
 * the page cannot be used to probe unpublished events.
 */
export const getTicket = base.tickets.get.handler(
  async ({ context, input }) => {
    const { ticketId } = input;

    const [row] = await db
      .select({
        checkedInAt: eventTicket.checkedInAt,
        code: eventTicket.id,
        endsAt: event.endsAt,
        eventId: event.id,
        eventTitle: event.title,
        registrationId: eventTicket.registrationId,
        startsAt: event.startsAt,
        visitorName: eventRegistration.guestName,
      })
      .from(eventTicket)
      .innerJoin(
        eventRegistration,
        eq(eventTicket.registrationId, eventRegistration.id)
      )
      .innerJoin(event, eq(eventRegistration.eventId, event.id))
      .where(and(eq(eventTicket.id, ticketId), eq(event.status, 'published')));

    if (!row?.visitorName) {
      throw notFound('Ticket not found');
    }

    // The ticket id is the door's credential and the page is public: a log
    // line at info that anyone can read must not be the way to get one.
    logger.info('ticket read', {
      eventId: row.eventId,
      registrationId: row.registrationId,
      requestId: context.requestId,
    });

    return {
      checkedInAt: row.checkedInAt,
      code: row.code,
      endsAt: row.endsAt,
      eventId: row.eventId,
      eventTitle: row.eventTitle,
      startsAt: row.startsAt,
      visitorName: row.visitorName,
    };
  }
);
