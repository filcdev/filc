import { getLogger } from '@logtape/logtape';
import { lt } from 'drizzle-orm';
import { db } from '#database';
import { notification } from '#database/schema/notifications';

const logger = getLogger(['chronos', 'notifications', 'cleanup']);

export async function cleanUpOldNotifications() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const deleted = await db
    .delete(notification)
    .where(lt(notification.createdAt, ninetyDaysAgo))
    .returning({ id: notification.id });

  if (deleted.length > 0) {
    logger.info(`Cleaned up ${deleted.length} old notifications`);
  }
}
