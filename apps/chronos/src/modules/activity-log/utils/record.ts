import { getLogger } from '@logtape/logtape';
import type { ChronosContext } from '#_types/globals';
import type { db as Db } from '#database';
import { db } from '#database';
import { activityLog } from '#modules/activity-log/schema';

type TxOrDb =
  | typeof db
  | Parameters<Parameters<(typeof Db)['transaction']>[0]>[0];

/**
 * A value's JSON form with object keys sorted, so two equal documents compare
 * equal even when their keys arrive in a different order: `jsonb` hands its
 * keys back length-then-bytes, while zod rebuilds an object in schema order.
 * Arrays keep their order, and a `Date` is serialized through its `toJSON`.
 */
const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, inner) =>
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))
        )
      : inner
  );

/**
 * Value equality for two column values: `Date`s by instant, objects/arrays by
 * their canonical JSON form, primitives with `===`.
 *
 * The `Date` branch is not exact: `timestamp` columns are naive, so a value read
 * back under a different host timezone still compares unequal.
 */
export const valuesEqual = (before: unknown, after: unknown): boolean => {
  if (before === after) {
    return true;
  }
  if (before instanceof Date || after instanceof Date) {
    return (
      before instanceof Date &&
      after instanceof Date &&
      before.getTime() === after.getTime()
    );
  }
  if (
    before !== null &&
    after !== null &&
    typeof before === 'object' &&
    typeof after === 'object'
  ) {
    return canonicalJson(before) === canonicalJson(after);
  }
  return false;
};

/**
 * Same values in any order, for the relation lists an extras key carries: a
 * PATCH that resends the same lesson ids in another order changed nothing.
 * Anything that is not two arrays falls back to `valuesEqual`.
 */
const equalUnordered = (before: unknown, after: unknown): boolean => {
  if (!(Array.isArray(before) && Array.isArray(after))) {
    return valuesEqual(before, after);
  }
  if (before.length !== after.length) {
    return false;
  }
  const left = before.map(canonicalJson).sort();
  const right = after.map(canonicalJson).sort();
  return left.every((value, index) => value === right[index]);
};

/**
 * Compact `{before, after}` diff over `keys`, or null when nothing changed.
 * Undefined fields in `after` (untouched inputs) are never recorded; extra
 * keys the caller computed (e.g. relation lists) come in as `extras` and are
 * recorded only when they differ from their `before` value, so a PATCH that
 * resends an unchanged list is not an update.
 *
 * A column value keeps its array order (`valuesEqual`); an extras key named in
 * `unordered` is a set of ids, where a reorder is not a change.
 */
export const diffActivity = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly string[],
  extras?: {
    after: Record<string, unknown>;
    before: Record<string, unknown>;
    /** Extras keys compared as multisets, so order does not matter. */
    unordered?: readonly string[];
  }
): {
  after: Record<string, unknown>;
  before: Record<string, unknown>;
} | null => {
  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};
  for (const key of keys) {
    if (after[key] !== undefined && !valuesEqual(before[key], after[key])) {
      beforeDiff[key] = before[key];
      afterDiff[key] = after[key];
    }
  }
  for (const [key, value] of Object.entries(extras?.after ?? {})) {
    const stored = extras?.before[key];
    const changed = extras?.unordered?.includes(key)
      ? !equalUnordered(stored, value)
      : !valuesEqual(stored, value);
    if (value !== undefined && changed) {
      beforeDiff[key] = stored;
      afterDiff[key] = value;
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
