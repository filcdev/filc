import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { cardDevice } from '#database/schema/doorlock';
import { syncDatabase } from '#routes/doorlock/websocket-handler';

const logger = getLogger(['chronos', 'doorlock', 'sync']);

export async function syncDevicesByIds(deviceIds: string[]) {
  const uniqueIds = Array.from(new Set(deviceIds.filter(Boolean)));

  await Promise.all(
    uniqueIds.map(async (deviceId) => {
      try {
        await syncDatabase(deviceId);
      } catch (error) {
        logger.error('Failed to sync device after card update', {
          deviceId,
          error,
        });
      }
    })
  );
}

export async function syncDevicesForCard(cardId: string) {
  const rows = await db
    .select({ deviceId: cardDevice.deviceId })
    .from(cardDevice)
    .where(eq(cardDevice.cardId, cardId));

  await syncDevicesByIds(rows.map((row) => row.deviceId));
}
