import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { desc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { device } from '#database/schema/doorlock';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { createSelectSchema, ensureJsonSafeDates } from '#utils/zod';
import { doorlockFactory } from './_factory';

const logger = getLogger(['chronos', 'doorlock', 'devices']);

const deviceSelectSchema = createSelectSchema(device);

const devicePayloadSchema = z.object({
  apiToken: z.string().min(1, 'API token is required'),
  lastResetReason: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  name: z.string().min(1, 'Device name is required'),
});

const { schema: devicePayloadRequestSchema } =
  await resolver(devicePayloadSchema).toOpenAPISchema();

type DevicePayload = z.infer<typeof devicePayloadSchema>;

const devicesResponseSchema = z.object({
  data: z.object({
    devices: z.array(deviceSelectSchema),
  }),
  success: z.literal(true),
});

const deviceResponseSchema = z.object({
  data: z.object({
    device: deviceSelectSchema,
  }),
  success: z.literal(true),
});

function mapDevicePayload(payload: DevicePayload) {
  return {
    apiToken: payload.apiToken,
    lastResetReason: payload.lastResetReason ?? null,
    location: payload.location ?? null,
    name: payload.name,
  } satisfies typeof device.$inferInsert;
}

function buildConstraintError(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'constraint' in error &&
    (error as { constraint?: string }).constraint === 'device_api_token_unique'
  ) {
    return new HTTPException(StatusCodes.CONFLICT, {
      message: 'A device with this API token already exists.',
    });
  }
  return null;
}

export const listDevicesRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'List all doorlock devices',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(devicesResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:devices:read'),
  async (c) => {
    const devices = await db
      .select()
      .from(device)
      .orderBy(desc(device.updatedAt));

    return c.json<SuccessResponse<{ devices: typeof devices }>>({
      data: { devices },
      success: true,
    });
  }
);

export const createDeviceRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Create a new doorlock device',
    requestBody: {
      content: {
        'application/json': {
          schema: devicePayloadRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(deviceResponseSchema)),
          },
        },
        description: 'Device created',
      },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:devices:write'),
  zValidator('json', devicePayloadSchema),
  async (c) => {
    const payload = c.req.valid('json');

    try {
      const [inserted] = await db
        .insert(device)
        .values(mapDevicePayload(payload))
        .returning();

      return c.json<SuccessResponse<{ device: typeof inserted }>>(
        {
          data: { device: inserted },
          success: true,
        },
        StatusCodes.CREATED
      );
    } catch (error) {
      logger.error('Failed to create device', { error });
      const knownError = buildConstraintError(error);
      if (knownError) {
        throw knownError;
      }
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to create device',
      });
    }
  }
);

export const updateDeviceRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Update an existing doorlock device',
    requestBody: {
      content: {
        'application/json': {
          schema: devicePayloadRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(deviceResponseSchema)),
          },
        },
        description: 'Device updated',
      },
      404: { description: 'Device not found' },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:devices:write'),
  zValidator('json', devicePayloadSchema),
  zValidator('param', z.object({ id: z.uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    try {
      const [updated] = await db
        .update(device)
        .set(mapDevicePayload(payload))
        .where(eq(device.id, id))
        .returning();

      if (!updated) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: 'Device not found',
        });
      }

      return c.json<SuccessResponse<{ device: typeof updated }>>({
        data: { device: updated },
        success: true,
      });
    } catch (error) {
      logger.error('Failed to update device', { error });
      const knownError = buildConstraintError(error);
      if (knownError) {
        throw knownError;
      }
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to update device',
      });
    }
  }
);

export const deleteDeviceRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Delete a doorlock device',
    responses: {
      200: { description: 'Device deleted' },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:devices:write'),
  zValidator('param', z.object({ id: z.uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(device)
      .where(eq(device.id, id))
      .returning();

    if (!deleted) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Device not found',
      });
    }

    return c.json<SuccessResponse>({ success: true });
  }
);
