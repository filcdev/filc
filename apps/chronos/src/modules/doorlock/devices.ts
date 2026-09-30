import type { DevicePayloadInput } from '@filcdev/api/domains/doorlock/devices';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { ORPCError } from '@orpc/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { device } from '#modules/doorlock/schema';
import { base } from '#orpc';
import { conflict, notFound } from '#utils/http';

const logger = getLogger(['chronos', 'doorlock', 'devices']);

function mapDevicePayload(payload: DevicePayloadInput) {
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
    return conflict('A device with this API token already exists.');
  }
  return null;
}

export const listDevices = base.doorlock.devices.list
  .use(requireAuthorization(permissions.doorlockDevicesRead))
  .handler(async () => {
    const devices = await db
      .select()
      .from(device)
      .orderBy(desc(device.updatedAt));

    return { devices };
  });

export const createDevice = base.doorlock.devices.create
  .use(requireAuthorization(permissions.doorlockDevicesWrite))
  .handler(async ({ input }) => {
    try {
      const [inserted] = await db
        .insert(device)
        .values(mapDevicePayload(input))
        .returning();

      if (!inserted) {
        throw new ORPCError('INTERNAL', {
          message: 'Failed to create device',
        });
      }

      return { device: inserted };
    } catch (error) {
      logger.error('Failed to create device', { error });
      const knownError = buildConstraintError(error);
      if (knownError) {
        throw knownError;
      }
      throw new ORPCError('INTERNAL', {
        cause: error,
        message: 'Failed to create device',
      });
    }
  });

export const updateDevice = base.doorlock.devices.update
  .use(requireAuthorization(permissions.doorlockDevicesWrite))
  .handler(async ({ input }) => {
    const { id, ...payload } = input;

    try {
      const [updated] = await db
        .update(device)
        .set(mapDevicePayload(payload))
        .where(eq(device.id, id))
        .returning();

      if (!updated) {
        throw notFound('Device not found');
      }

      return { device: updated };
    } catch (error) {
      logger.error('Failed to update device', { error });
      const knownError = buildConstraintError(error);
      if (knownError) {
        throw knownError;
      }
      if (error instanceof ORPCError) {
        throw error;
      }
      throw new ORPCError('INTERNAL', {
        cause: error,
        message: 'Failed to update device',
      });
    }
  });

export const deleteDevice = base.doorlock.devices.delete
  .use(requireAuthorization(permissions.doorlockDevicesWrite))
  .handler(async ({ input }) => {
    const [deleted] = await db
      .delete(device)
      .where(eq(device.id, input.id))
      .returning({ id: device.id });

    if (!deleted) {
      throw notFound('Device not found');
    }

    return deleted;
  });
