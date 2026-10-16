import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { sendMessage } from '#modules/doorlock/device-socket';
import { device as lockDevice } from '#modules/doorlock/schema';
import { base } from '#orpc';
import { notFound } from '#utils/http';

const logger = getLogger(['chronos', 'doorlock', 'ota']);

export const triggerDeviceOta = base.doorlock.devices.triggerOta
  .use(requireAuthorization(permissions.doorlockDevicesWrite))
  .handler(async ({ input }) => {
    const { id, url } = input;

    const [dev] = await db
      .select({ id: lockDevice.id, name: lockDevice.name })
      .from(lockDevice)
      .where(eq(lockDevice.id, id))
      .limit(1);

    if (!dev) {
      throw notFound('Device not found');
    }

    logger.info('Triggering OTA update for device', {
      device: dev,
      url,
    });

    sendMessage({ type: 'update', url }, dev.id);

    return { ok: true as const };
  });

export const triggerBulkOta = base.doorlock.devices.updateAll
  .use(requireAuthorization(permissions.doorlockDevicesWrite))
  .handler(async ({ input }) => {
    const { url } = input;

    const devices = await db
      .select({ id: lockDevice.id, name: lockDevice.name })
      .from(lockDevice);

    logger.info('Triggering bulk OTA update', {
      count: devices.length,
      url,
    });

    for (const dev of devices) {
      sendMessage({ type: 'update', url }, dev.id);
    }

    return { count: devices.length };
  });
