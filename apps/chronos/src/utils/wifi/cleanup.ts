import { getLogger } from '@logtape/logtape';
import { captureException } from '@sentry/bun';
import { lte } from 'drizzle-orm';
import { db } from '#database';
import { wifiAuthLog } from '#database/schema/wifi';

const logger = getLogger(['chronos', 'wifi', 'cleanup']);

export async function cleanUpWifiAuthLogs() {
  logger.info('Starting WiFi auth log cleanup');
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const deleted = await db
      .delete(wifiAuthLog)
      .where(lte(wifiAuthLog.timestamp, ninetyDaysAgo))
      .returning({ id: wifiAuthLog.id });

    logger.info(`Cleaned up ${deleted.length} old WiFi auth logs`);
  } catch (error) {
    logger.error('Failed to clean up WiFi auth logs: {error}', { error });
    captureException(error);
  }
}
