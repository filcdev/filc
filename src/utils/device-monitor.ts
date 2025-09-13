import { getLogger } from '@logtape/logtape';
import { and, isNotNull, lt, ne, sql } from 'drizzle-orm';
import { db } from '~/database';
import { doorlockSchema } from '~/database/schema/doorlock';
import { handleFeatureFlag } from '~/utils/feature-flag';

const logger = getLogger(['chronos', 'device-monitor']);

// Run every DEVICE_SWEEP_INTERVAL_MS to mark stale devices offline.
const DEVICE_SWEEP_INTERVAL_MS = 15_000; // 15s

let intervalHandle: Timer | null = null;

export const startDeviceMonitor = async () => {
  const enabled = await handleFeatureFlag(
    'doorlock:monitor',
    'Enable device monitoring',
    false
  );

  if (!enabled) {
    logger.info('Device monitor is disabled via feature flag');
    return;
  }

  if (intervalHandle) {
    return; // already started
  }
  intervalHandle = setInterval(async () => {
    try {
      const now = new Date();
      const updatedDevices = await db
        .update(doorlockSchema.device)
        .set({
          status: 'offline',
          updatedAt: now,
        })
        .where(
          and(
            ne(doorlockSchema.device.status, 'offline'),
            isNotNull(doorlockSchema.device.lastSeenAt),
            lt(
              sql`${doorlockSchema.device.lastSeenAt} + ${doorlockSchema.device.ttlSeconds} * interval '1 second'`,
              now
            )
          )
        )
        .returning({ id: doorlockSchema.device.id });
      const rowsLength = updatedDevices.length;
      if (rowsLength) {
        logger.debug(
          `Marked ${rowsLength} device(s) offline due to heartbeat timeout`
        );
      } else {
        logger.trace('No devices needed to be marked offline');
      }
    } catch (err) {
      logger.error('Device monitor sweep error', { err });
      throw err;
    }
  }, DEVICE_SWEEP_INTERVAL_MS);
  logger.info('Device monitor started');
};

export const stopDeviceMonitor = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Device monitor stopped');
  }
};
