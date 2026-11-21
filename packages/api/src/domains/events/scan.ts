import z from 'zod';

/**
 * One event the caller may check tickets in at.
 *
 * `expiresAt` is the door grant's own deadline and is null for a caller who
 * holds the global `events:checkin` permission: that one needs no grant per
 * event. A helper sees only events they were approved for, each with the
 * moment their access lapses.
 */
export const eventScanEventSchema = z.object({
  endsAt: z.date(),
  /** Null when the caller scans through the global permission. */
  expiresAt: z.date().nullable(),
  id: z.uuid(),
  startsAt: z.date(),
  title: z.string(),
});

export type EventScanEvent = z.infer<typeof eventScanEventSchema>;
