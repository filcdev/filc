import z from 'zod';
import { eventIdInputSchema } from './event';
import { eventCheckinRuleSchema } from './rules';

/**
 * One scanner's door configuration. A null `userId` is the event's default; a
 * set one is that helper's own rules, which win when they scan.
 *
 * The rule list is the whole door setting for its scanner: identity, shown
 * answers and the admission decision all live here.
 */
export const eventCheckinConfigSchema = z.object({
  createdAt: z.date(),
  eventId: z.uuid(),
  id: z.uuid(),
  rules: z.array(eventCheckinRuleSchema),
  updatedAt: z.date(),
  userId: z.uuid().nullable(),
  /** The helper's name; null for the default row and a deleted account. */
  userName: z.string().nullable(),
});

export type EventCheckinConfig = z.infer<typeof eventCheckinConfigSchema>;

/** `GET /events/{id}/checkin-configs`: the default plus every helper override. */
export const eventCheckinConfigListInputSchema = eventIdInputSchema;

/**
 * `PUT /events/{id}/checkin-configs`: write one scanner's rules. `userId: null`
 * writes the event default, an id writes that helper's override. Both are
 * upserts, so saving the same scanner twice keeps one row.
 */
export const eventCheckinConfigUpsertSchema = eventIdInputSchema.extend({
  rules: z.array(eventCheckinRuleSchema),
  userId: z.uuid().nullable(),
});

export type EventCheckinConfigUpsertInput = z.infer<
  typeof eventCheckinConfigUpsertSchema
>;

/**
 * `DELETE /events/{id}/checkin-configs/{userId}`: drop a helper's override, so
 * their next scan is judged by the event default.
 */
export const eventCheckinConfigDeleteSchema = eventIdInputSchema.extend({
  userId: z.uuid(),
});

export type EventCheckinConfigDeleteInput = z.infer<
  typeof eventCheckinConfigDeleteSchema
>;
