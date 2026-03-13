import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { device as lockDevice } from '#database/schema/doorlock';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { sendMessage } from '#routes/doorlock/websocket-handler';
import { doorlockFactory } from './_factory';

const logger = getLogger(['chronos', 'doorlock', 'ota']);

const otaPayloadSchema = z.object({
  url: z.url('A valid firmware URL is required'),
});

export const triggerDeviceOtaRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Trigger an OTA update on a specific device',
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {
          description: 'The doorlock device ID.',
          type: 'string',
        },
      },
    ],
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
  requireAuthentication,
  requireAuthorization('doorlock:devices:write'),
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
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Device not found',
      });
    }

    logger.info('Triggering OTA update for device', {
      device: dev,
      url,
    });

    sendMessage({ type: 'update', url }, dev.id);

    return c.json<SuccessResponse>({ success: true });
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
  requireAuthentication,
  requireAuthorization('doorlock:devices:write'),
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

    return c.json<SuccessResponse<{ count: number }>>({
      data: { count: devices.length },
      success: true,
    });
  }
);
