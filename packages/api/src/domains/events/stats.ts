import z from 'zod';
import { eventSeatsSchema } from './event';
import { eventFieldTypeSchema } from './fields';

/**
 * How many confirmed registrations answered one question. A select also carries
 * its options with their counts — every configured option, zeros included, so
 * the chart never has to invent a missing slice. The other types carry `null`:
 * their answers are free text, and only the number who answered is a number.
 */
export const eventAnswerSummarySchema = z.object({
  answered: z.number(),
  fieldId: z.uuid(),
  label: z.string(),
  options: z
    .array(z.object({ count: z.number(), value: z.string() }))
    .nullable(),
  type: eventFieldTypeSchema,
});

export type EventAnswerSummary = z.infer<typeof eventAnswerSummarySchema>;

/** One day with at least one registration, in the event's own timeline. */
export const eventRegistrationDaySchema = z.object({
  /** `YYYY-MM-DD`, the day the registration was made. */
  count: z.number(),
  date: z.string(),
});

/**
 * `GET /events/{id}/stats`: plain numbers for the organizer, nothing shaped for
 * a particular chart. Answers count the confirmed registrations only — the
 * people actually coming — while `byStatus` still reports the cancellations.
 */
export const eventStatsSchema = z.object({
  answers: z.array(eventAnswerSummarySchema),
  byRole: z.object({
    helper: z.number(),
    participant: z.number(),
    visitor: z.number(),
  }),
  byStatus: z.object({
    cancelled: z.number(),
    confirmed: z.number(),
    /** Helper signups waiting for the organizer's approval. */
    pending: z.number(),
  }),
  /** Tickets the scanner has stamped for this event. */
  checkedIn: z.number(),
  /**
   * Confirmed helper rows. The number the event's helper cap is judged on:
   * pending applications have not taken a slot, and declined or cancelled rows
   * gave theirs back.
   */
  confirmedHelpers: z.number(),
  /**
   * Registrations per day, sparse: only days with at least one registration,
   * oldest first. Cancelled rows are counted, because they were registrations
   * when they were made.
   */
  perDay: z.array(eventRegistrationDaySchema),
  seats: eventSeatsSchema,
});

export type EventStats = z.infer<typeof eventStatsSchema>;
