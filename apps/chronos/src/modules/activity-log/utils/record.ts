import { getLogger } from '@logtape/logtape';
import type { ChronosContext } from '#_types/globals';
import type { db as Db } from '#database';
import { db } from '#database';
import { activityLog } from '#modules/activity-log/schema';

type TxOrDb =
  | typeof db
  | Parameters<Parameters<(typeof Db)['transaction']>[0]>[0];

/**
 * Compact `{before, after}` diff over `keys`, or null when nothing changed.
 * Undefined fields in `after` (untouched inputs) are never recorded; extra
 * keys the caller computed (e.g. relation lists) come in as `extras`.
 */
export const diffActivity = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly string[],
  extras?: { after: Record<string, unknown>; before: Record<string, unknown> }
): {
  after: Record<string, unknown>;
  before: Record<string, unknown>;
} | null => {
  const beforeDiff: Record<string, unknown> = { ...extras?.before };
  const afterDiff: Record<string, unknown> = { ...extras?.after };
  for (const key of keys) {
    // Arrays compare by content, not reference: pass an array twice and the
    // reference differs while the value does not.
    if (
      after[key] !== undefined &&
      after[key] !== before[key] &&
      !(
        Array.isArray(after[key]) &&
        Array.isArray(before[key]) &&
        JSON.stringify(after[key]) === JSON.stringify(before[key])
      )
    ) {
      beforeDiff[key] = before[key];
      afterDiff[key] = after[key];
    }
  }
  return Object.keys(afterDiff).length === 0
    ? null
    : { after: afterDiff, before: beforeDiff };
};

/**
 * Best-effort audit insert. Awaited so it shares the caller's transaction
 * when one is passed, but a failure only logs — it never fails the mutation
 * being recorded.
 */
export const recordActivity = async (
  context: ChronosContext,
  log: {
    action: string;
    entityId?: string | null;
    entityType: string;
    metadata?: unknown;
  },
  tx?: TxOrDb
): Promise<void> => {
  try {
    await (tx ?? db).insert(activityLog).values({
      action: log.action,
      actorId: context.user?.id ?? null,
      entityId: log.entityId ?? null,
      entityType: log.entityType,
      ipAddress: context.clientIp,
      metadata: log.metadata ?? null,
      userAgent: context.reqHeaders?.get('user-agent') ?? null,
    });
  } catch (error) {
    getLogger('chronos').warn(
      'Failed to record activity log for {entityType}/{action}: {error}',
      { action: log.action, entityType: log.entityType, error }
    );
  }
};
