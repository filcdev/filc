import { getLogger } from '@logtape/logtape';
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
