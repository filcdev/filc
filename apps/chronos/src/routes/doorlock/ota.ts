import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { describeRoute } from 'hono-openapi';
import z from 'zod';
import { db } from '#database';
import { device as lockDevice } from '#database/schema/doorlock';
import { authRouter } from '#middleware/auth';
import { sendMessage } from '#routes/doorlock/websocket-handler';
import { notFound, ok } from '#utils/http';
import { doorlockFactory } from './_factory';

const logger = getLogger(['chronos', 'doorlock', 'ota']);

const otaPayloadSchema = z.object({
  url: z.url('A valid firmware URL is required'),
});

export const triggerDeviceOtaRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Trigger an OTA update on a specific device',
    requestBody: {
      content: {
        'application/json': {
          schema: { properties: { url: { type: 'string' } }, type: 'object' },
        },
      },
    },
    responses: {
      200: { description: 'OTA update triggered' },
      404: { description: 'Device not found' },
    },
    tags: ['Doorlock'],
  }),
  ...authRouter('doorlock:devices:write'),
  zValidator('param', z.object({ id: z.uuid() })),
  zValidator('json', otaPayloadSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { url } = c.req.valid('json');

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

    return ok(c, undefined);
  }
);

export const triggerBulkOtaRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Trigger an OTA update on all devices',
    requestBody: {
      content: {
        'application/json': {
          schema: { properties: { url: { type: 'string' } }, type: 'object' },
        },
      },
    },
    responses: {
      200: { description: 'OTA update triggered on all devices' },
    },
    tags: ['Doorlock'],
  }),
  ...authRouter('doorlock:devices:write'),
  zValidator('json', otaPayloadSchema),
  async (c) => {
    const { url } = c.req.valid('json');

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

    return ok(c, { count: devices.length });
  }
);
