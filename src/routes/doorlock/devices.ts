import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { db } from '~/database';
import { cardDevice, device } from '~/database/schema/doorlock';
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

// Device list
export const listDevices = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const rows = await db.select().from(device);
    return c.json(rows);
  }
);

// Get single device (with optional card restrictions)
export const getDevice = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing id' }, StatusCodes.BAD_REQUEST);
    }
    const [row] = await db
      .select()
      .from(device)
      .where(eq(device.id, id))
      .limit(1);
    if (!row) {
      return c.json({ error: 'Not found' }, StatusCodes.NOT_FOUND);
    }
    return c.json(row);
  }
);

// Create / overwrite device
export const upsertDevice = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('device:upsert'),
  async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    const parsed = upsertDeviceSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        StatusCodes.BAD_REQUEST
      );
    }
    const now = new Date();
    try {
      if (!id) {
        return c.json({ error: 'Missing id' }, StatusCodes.BAD_REQUEST);
      }
      const [existing] = await db
        .select({ id: device.id })
        .from(device)
        .where(eq(device.id, id));
      if (existing) {
        const [updated] = await db
          .update(device)
          .set({
            name: parsed.data.name,
            location: parsed.data.location,
            ttlSeconds: parsed.data.ttlSeconds ?? DEFAULT_TTL_SECONDS,
            updatedAt: now,
          })
          .where(eq(device.id, id))
          .returning();
        return c.json(updated);
      }
      const [inserted] = await db
        .insert(device)
        .values({
          id,
          name: parsed.data.name,
          location: parsed.data.location,
          ttlSeconds: parsed.data.ttlSeconds ?? DEFAULT_TTL_SECONDS,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return c.json(inserted, StatusCodes.CREATED);
    } catch (err) {
      return c.json(
        { error: 'Failed to upsert device', details: String(err) },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
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
      return c.json({ error: 'Missing id' }, StatusCodes.BAD_REQUEST);
    }
    try {
      const [deleted] = await db
        .delete(device)
        .where(eq(device.id, id))
        .returning();
      if (!deleted) {
        return c.json({ error: 'Not found' }, StatusCodes.NOT_FOUND);
      }
      return c.json(deleted);
    } catch (err) {
      return c.json(
        { error: 'Failed to delete device', details: String(err) },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

// List cards restrictions for a device
export const listDeviceCards = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing id' }, StatusCodes.BAD_REQUEST);
    }
    const rows = await db
      .select({
        cardId: cardDevice.cardId,
        deviceId: cardDevice.deviceId,
      })
      .from(cardDevice)
      .where(eq(cardDevice.deviceId, id));
    return c.json(rows);
  }
);

// Assign card restrictions (replace set)
export const replaceDeviceCards = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('device:assign_cards'),
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing id' }, StatusCodes.BAD_REQUEST);
    }
    const body = await c.req.json().catch(() => null);
    const parsed = assignCardsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        StatusCodes.BAD_REQUEST
      );
    }
    try {
      await db.delete(cardDevice).where(eq(cardDevice.deviceId, id));
      if (parsed.data.cardIds.length) {
        await db
          .insert(cardDevice)
          .values(
            parsed.data.cardIds.map((cid) => ({ cardId: cid, deviceId: id }))
          );
      }
      return c.json({ status: 'ok', count: parsed.data.cardIds.length });
    } catch (err) {
      return c.json(
        { error: 'Failed to assign cards', details: String(err) },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

// Get device effective online status (computed from lastSeenAt/ttlSeconds)
export const getDeviceStatus = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing id' }, StatusCodes.BAD_REQUEST);
    }
    const [row] = await db
      .select()
      .from(device)
      .where(eq(device.id, id))
      .limit(1);
    if (!row) {
      return c.json({ error: 'Not found' }, StatusCodes.NOT_FOUND);
    }
    const now = Date.now();
    const last = row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : 0;
    const ttl = (row.ttlSeconds ?? DEFAULT_TTL_SECONDS) * SECOND_IN_MS;
    const online = !!last && now - last <= ttl;
    return c.json({
      id: row.id,
      online,
      lastSeenAt: row.lastSeenAt,
      ttlSeconds: row.ttlSeconds,
    });
  }
);
