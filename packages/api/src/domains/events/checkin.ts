import z from 'zod';
import { eventFieldTypeSchema } from './fields';

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
 * One answer of the scanned registration, revealed only behind the scanner's
 * "more information" button. Independent of what the matched rule chose to
 * show: that setting picks the always-visible rows, this list is what the
 * helper can open on demand.
 *
 * A checkbox is a boolean here (the stored string is an implementation detail),
 * so the scanner can draw a tick or a cross instead of the word `true`.
 */
export const eventCheckinDetailSchema = z.object({
  fieldId: z.uuid(),
  label: z.string(),
  type: eventFieldTypeSchema,
  value: z.union([z.string(), z.boolean()]),
});

export type EventCheckinDetail = z.infer<typeof eventCheckinDetailSchema>;

/**
 * The visitor as the matched rule allows the door to see. The two identity
 * fields are omitted — not null, not an empty string — when the rule hides
 * them, so the handler, not the client, enforces the rule's `show` block.
 */
const checkinVisitorSchema = z.object({
  /**
   * The answers the matched rule chose in its `show.fieldIds`, in that order. A
   * question the registration left unanswered is omitted rather than sent
   * empty.
   */
  answers: z.array(eventCheckinAnswerSchema),
  /**
   * Every answer of the registration, for the scanner's details panel. Never
   * contains the visitor's email; identity stays governed by the rule's `show`.
   */
  details: z.array(eventCheckinDetailSchema),
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
  /**
   * A rule denied this registration. Nothing is written, so a corrected
   * registration can still be admitted later. `message` is the rule's own
   * wording, which the scanner shows verbatim.
   */
  checkinVisitorSchema.extend({
    message: z.string(),
    status: z.literal('not_granted'),
  }),
  z.object({ status: z.literal('not_found') }),
]);

export type EventCheckinResult = z.infer<typeof eventCheckinResultSchema>;
