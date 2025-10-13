import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { db } from '~/database';
import { cardDevice, device } from '~/database/schema/doorlock';
import { env } from '~/utils/environment';
import type { SuccessResponse } from '~/utils/globals';
import {
  requireAuthentication,
  requireAuthorization,
} from '~/utils/middleware';
import { doorlockFactory } from './_factory';

// Schemas
const MAX_TTL_SECONDS = 3600;
const DEFAULT_TTL_SECONDS = 30;
const SECOND_IN_MS = 1000;

const upsertDeviceSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  ttlSeconds: z.number().int().positive().max(MAX_TTL_SECONDS).optional(),
});

const assignCardsSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1),
});

export const listDevices = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const rows = await db.select().from(device);
    return c.json<SuccessResponse<typeof rows>>({
      success: true,
      data: rows,
    });
  }
);

export const getDevice = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing id',
      });
    }
    const [row] = await db
      .select()
      .from(device)
      .where(eq(device.id, id))
      .limit(1);
    if (!row) {
      throw new HTTPException(StatusCodes.NOT_FOUND, { message: 'Not found' });
    }
    return c.json<SuccessResponse<typeof row>>({
      success: true,
      data: row,
    });
  }
);

// Create / overwrite device
export const upsertDevice = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('device:upsert'),
  zValidator('json', upsertDeviceSchema),
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing id',
      });
    }
    const data = c.req.valid('json');
    const now = new Date();
    try {
      const [existing] = await db
        .select({ id: device.id })
        .from(device)
        .where(eq(device.id, id));
      if (existing) {
        const [updated] = await db
          .update(device)
          .set({
            name: data.name,
            location: data.location,
            ttlSeconds: data.ttlSeconds ?? DEFAULT_TTL_SECONDS,
            updatedAt: now,
          })
          .where(eq(device.id, id))
          .returning();
        return c.json<SuccessResponse>({
          success: true,
          data: updated,
        });
      }
      const [inserted] = await db
        .insert(device)
        .values({
          id,
          name: data.name,
          location: data.location,
          ttlSeconds: data.ttlSeconds ?? DEFAULT_TTL_SECONDS,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return c.json<SuccessResponse>(
        {
          success: true,
          data: inserted,
        },
        StatusCodes.CREATED
      );
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to upsert device',
        cause: env.mode === 'development' ? String(err) : undefined,
      });
    }
  }
);

// Delete device
export const deleteDevice = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('device:delete'),
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing id',
      });
    }
    try {
      const [deleted] = await db
        .delete(device)
        .where(eq(device.id, id))
        .returning();
      if (!deleted) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: 'Not found',
        });
      }
      return c.json<SuccessResponse>({
        success: true,
        data: deleted,
      });
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to delete device',
        cause: env.mode === 'development' ? String(err) : undefined,
      });
    }
  }
);

// List cards restrictions for a device
export const listDeviceCards = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing id',
      });
    }
    const rows = await db
      .select({
        cardId: cardDevice.cardId,
        deviceId: cardDevice.deviceId,
      })
      .from(cardDevice)
      .where(eq(cardDevice.deviceId, id));
    return c.json<SuccessResponse>({
      success: true,
      data: rows,
    });
  }
);

// Assign card restrictions (replace set)
export const replaceDeviceCards = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('device:assign_cards'),
  zValidator('json', assignCardsSchema),
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing id',
      });
    }
    const data = c.req.valid('json');
    try {
      await db.delete(cardDevice).where(eq(cardDevice.deviceId, id));
      if (data.cardIds.length) {
        await db
          .insert(cardDevice)
          .values(data.cardIds.map((cid) => ({ cardId: cid, deviceId: id })));
      }
      return c.json<SuccessResponse>({
        success: true,
        data: { assignedCardIds: data.cardIds, deviceId: id },
      });
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to assign cards',
        cause: env.mode === 'development' ? String(err) : undefined,
      });
    }
  }
);

// Get device effective online status (computed from lastSeenAt/ttlSeconds)
export const getDeviceStatus = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing id',
      });
    }
    const [row] = await db
      .select()
      .from(device)
      .where(eq(device.id, id))
      .limit(1);
    if (!row) {
      throw new HTTPException(StatusCodes.NOT_FOUND, { message: 'Not found' });
    }
    const now = Date.now();
    const last = row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : 0;
    const ttl = (row.ttlSeconds ?? DEFAULT_TTL_SECONDS) * SECOND_IN_MS;
    const online = !!last && now - last <= ttl;
    return c.json<SuccessResponse>({
      success: true,
      data: {
        id: row.id,
        online,
        lastSeenAt: row.lastSeenAt,
        ttlSeconds: row.ttlSeconds,
      },
    });
  }
);
