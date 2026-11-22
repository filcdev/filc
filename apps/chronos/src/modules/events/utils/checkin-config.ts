import type { EventCheckinRule } from '@filcdev/api/domains/events/rules';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { eventCheckinConfig } from '#modules/events/schema';

/** What the resolver needs of one config row. */
export type CheckinConfigChoice = {
  rules: EventCheckinRule[];
  userId: string | null;
};

/** Which stored row (or the implicit fallback) judged a scan. */
export type CheckinRuleSource = 'helper' | 'default' | 'fallback';

/**
 * The config that judges one scanner: their own override when it exists, the
 * event default otherwise, and `null` when neither row is stored.
 *
 * Pure, because the fallback is a product decision — `null` means the door
 * admits and shows only the name — and that must be asserted without a
 * database. The helper row is looked up first on purpose: an override is the
 * whole point of a per-scanner config.
 */
export const pickCheckinConfig = (
  configs: readonly CheckinConfigChoice[],
  userId: string
): CheckinConfigChoice | null =>
  configs.find((config) => config.userId === userId) ??
  configs.find((config) => config.userId === null) ??
  null;

/** Every stored config of one event: the default and the helper overrides. */
export const findCheckinConfigs = (eventId: string) =>
  db
    .select()
    .from(eventCheckinConfig)
    .where(eq(eventCheckinConfig.eventId, eventId));

/**
 * The rules one scan is judged with. A stored row wins, helper before default;
 * with neither stored the empty list is the implicit fallback, which the door
 * reads as "admit, show the name only" (see `FALLBACK_SHOW` in `checkin.ts`).
 *
 * The source rides along for the log line: "denied" needs to be explainable as
 * this helper's rule, the event default or the fallback.
 */
export const resolveCheckinRules = async (
  eventId: string,
  userId: string
): Promise<{ rules: EventCheckinRule[]; source: CheckinRuleSource }> => {
  const chosen = pickCheckinConfig(await findCheckinConfigs(eventId), userId);
  if (!chosen) {
    return { rules: [], source: 'fallback' };
  }
  return {
    rules: chosen.rules,
    source: chosen.userId === null ? 'default' : 'helper',
  };
};
