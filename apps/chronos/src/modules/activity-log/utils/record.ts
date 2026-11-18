import { getLogger } from '@logtape/logtape';
import type { ChronosContext } from '#_types/globals';
import type { db as Db } from '#database';
import { db } from '#database';
import { activityLog } from '#modules/activity-log/schema';

type TxOrDb =
  | typeof db
  | Parameters<Parameters<(typeof Db)['transaction']>[0]>[0];

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
