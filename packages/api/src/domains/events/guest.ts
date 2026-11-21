import z from 'zod';
import { eventRegistrationAnswerSchema } from './registration';

/**
 * The body of `POST /events/{id}/guests`: a visitor's own details and the
 * answers to the event's guest questions. No account, so no `userId`.
 */
export const eventGuestCreateSchema = z.object({
  answers: z.array(eventRegistrationAnswerSchema).optional(),
  email: z.email(),
  name: z.string().trim().min(1),
});

export type EventGuestCreateInput = z.infer<typeof eventGuestCreateSchema>;

/**
 * What a guest signup answers. The registration id stays server-side detail;
 * the code is what the visitor needs to open or quote their ticket.
 */
export const eventGuestResultSchema = z.object({
  code: z.uuid(),
  registrationId: z.uuid(),
});

export type EventGuestResult = z.infer<typeof eventGuestResultSchema>;

/**
 * What the public ticket page shows: the event, its date, who is coming and
 * whether the code was already scanned. Deliberately no answers and no email —
 * anyone holding the link can read this.
 */
export const eventTicketSchema = z.object({
  /** Null until the scanner phase checks the code in. */
  checkedInAt: z.date().nullable(),
  /** The ticket id, which is also the QR payload. */
  code: z.uuid(),
  endsAt: z.date(),
  eventId: z.uuid(),
  eventTitle: z.string(),
  startsAt: z.date(),
  visitorName: z.string(),
});

export type EventTicket = z.infer<typeof eventTicketSchema>;

/** `GET /tickets/{ticketId}`: the code is the path parameter. */
export const eventTicketInputSchema = z.object({ ticketId: z.uuid() });
