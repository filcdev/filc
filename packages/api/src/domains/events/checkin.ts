import z from 'zod';

/**
 * The body of `POST /events/{id}/checkin`, scanned at the door.
 *
 * `code` is the ticket id a QR carries, and it is deliberately a plain string:
 * a hand-typed code is not guaranteed to be a uuid, and a malformed one is an
 * ordinary "not found" at the door, not a validation error the helper cannot
 * act on. The endpoint checks the shape before it queries.
 */
export const eventCheckinInputSchema = z.object({
  code: z.string().trim().min(1),
  id: z.uuid(),
});

export type EventCheckinInput = z.infer<typeof eventCheckinInputSchema>;

/** One configured answer the door shows, with the question's own label. */
export const eventCheckinAnswerSchema = z.object({
  fieldId: z.uuid(),
  label: z.string(),
  value: z.string(),
});

export type EventCheckinAnswer = z.infer<typeof eventCheckinAnswerSchema>;

/**
 * Who the ticket belongs to, as far as this event lets the door see. Both
 * fields are omitted — not null, not an empty string — when `checkinDisplay`
 * hides them: `minimal` sends neither, `name` only the name, `full` both. The
 * handler shapes the payload from the event's setting, so a client cannot
 * widen it; the nullable type is for a stored `null`, never a hidden value.
 */
const checkinVisitorSchema = z.object({
  /**
   * The answers the organizer selected in `event.checkinFields`, in that
   * order. Independent of the display mode: `minimal` with answers shows them
   * and no identity. A configured question the registration left unanswered is
   * omitted rather than sent empty.
   */
  answers: z.array(eventCheckinAnswerSchema),
  registrationId: z.uuid(),
  visitorEmail: z.email().nullish(),
  visitorName: z.string().nullish(),
});

/**
 * What one scan answers. Every branch is a state the door renders, so an
 * unknown code is a 200 with `not_found` rather than a 404 the helper would
 * read as "the app broke".
 *
 * A ticket of another event answers exactly like an unknown one: the endpoint
 * must never confirm that a foreign code exists.
 */
export const eventCheckinResultSchema = z.discriminatedUnion('status', [
  checkinVisitorSchema.extend({ status: z.literal('admitted') }),
  checkinVisitorSchema.extend({
    /** The first scan's time, so a helper can see who came in when. */
    checkedInAt: z.date(),
    /** The colleague who let them in; null once that account is deleted. */
    checkedInByName: z.string().nullable(),
    status: z.literal('already_checked_in'),
  }),
  /** A cancelled registration: the ticket is real, the place is not. */
  checkinVisitorSchema.extend({ status: z.literal('invalid') }),
  z.object({ status: z.literal('not_found') }),
]);

export type EventCheckinResult = z.infer<typeof eventCheckinResultSchema>;
