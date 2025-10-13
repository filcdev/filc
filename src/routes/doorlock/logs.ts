import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { db } from '~/database';
import { user } from '~/database/schema/authentication';
import { accessLog, card, device } from '~/database/schema/doorlock';
import type { SuccessResponse } from '~/utils/globals';
import {
  requireAuthentication,
  requireAuthorization,
} from '~/utils/middleware';
import { doorlockFactory } from './_factory';

const listLogsSchema = z.object({
  deviceId: z.string().optional(),
  result: z.enum(['granted', 'denied']).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional().default(100),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

const addUnknownCardSchema = z.object({
  tag: z.string().min(1),
  userId: z.string().uuid(),
  label: z.string().optional(),
});

// List access logs with filters
export const listLogs = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('doorlock:logs:read'),
  zValidator('query', listLogsSchema),
  async (c) => {
    const { deviceId, result, limit, offset } = c.req.valid('query');

    const conditions: ReturnType<typeof eq>[] = [];
    if (deviceId) {
      conditions.push(eq(accessLog.deviceId, deviceId));
    }
    if (result) {
      conditions.push(eq(accessLog.result, result));
    }

    const logs = await db
      .select({
        id: accessLog.id,
        deviceId: accessLog.deviceId,
        deviceName: device.name,
        tag: accessLog.tag,
        cardId: accessLog.cardId,
        cardLabel: card.label,
        userId: accessLog.userId,
        userName: user.name,
        result: accessLog.result,
        reason: accessLog.reason,
        timestamp: accessLog.timestamp,
      })
      .from(accessLog)
      .leftJoin(device, eq(accessLog.deviceId, device.id))
      .leftJoin(card, eq(accessLog.cardId, card.id))
      .leftJoin(user, eq(accessLog.userId, user.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(accessLog.timestamp))
      .limit(limit)
      .offset(offset);

    return c.json<SuccessResponse>({
      success: true,
      data: logs,
    });
  }
);

// Get a single log entry
export const getLog = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('doorlock:logs:read'),
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing id',
      });
    }

    const [log] = await db
      .select({
        id: accessLog.id,
        deviceId: accessLog.deviceId,
        deviceName: device.name,
        tag: accessLog.tag,
        cardId: accessLog.cardId,
        cardLabel: card.label,
        userId: accessLog.userId,
        userName: user.name,
        result: accessLog.result,
        reason: accessLog.reason,
        timestamp: accessLog.timestamp,
      })
      .from(accessLog)
      .leftJoin(device, eq(accessLog.deviceId, device.id))
      .leftJoin(card, eq(accessLog.cardId, card.id))
      .leftJoin(user, eq(accessLog.userId, user.id))
      .where(eq(accessLog.id, id))
      .limit(1);

    if (!log) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Log entry not found',
      });
    }

    return c.json<SuccessResponse>({
      success: true,
      data: log,
    });
  }
);

// List unknown tags (logs where cardId is null)
export const listUnknownTags = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('doorlock:logs:read'),
  async (c) => {
    // Get unique unknown tags from logs
    const unknownTags = await db
      .selectDistinct({
        tag: accessLog.tag,
        lastSeen: sql<Date>`MAX(${accessLog.timestamp})`,
        deviceId: accessLog.deviceId,
        deviceName: device.name,
        accessCount: sql<number>`COUNT(*)`,
      })
      .from(accessLog)
      .leftJoin(device, eq(accessLog.deviceId, device.id))
      .where(isNull(accessLog.cardId))
      .groupBy(accessLog.tag, accessLog.deviceId, device.name)
      .orderBy(desc(sql`MAX(${accessLog.timestamp})`));

    return c.json<SuccessResponse>({
      success: true,
      data: unknownTags,
    });
  }
);

// Add an unknown tag as a new card
export const addUnknownCard = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('card:create'),
  zValidator('json', addUnknownCardSchema),
  async (c) => {
    const { tag, userId, label } = c.req.valid('json');

    // Check if card already exists with this tag
    const existing = await db
      .select({ id: card.id })
      .from(card)
      .where(eq(card.tag, tag))
      .limit(1);

    if (existing.length > 0) {
      throw new HTTPException(StatusCodes.CONFLICT, {
        message: 'Card with this tag already exists',
      });
    }

    const [newCard] = await db
      .insert(card)
      .values({
        tag,
        userId,
        label,
        frozen: false,
        disabled: false,
      })
      .returning();

    return c.json<SuccessResponse>(
      {
        success: true,
        data: newCard,
      },
      StatusCodes.CREATED
    );
  }
);

// Get logs for a specific device
export const getDeviceLogs = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('doorlock:logs:read'),
  zValidator('query', listLogsSchema.omit({ deviceId: true })),
  async (c) => {
    const deviceId = c.req.param('deviceId');
    if (!deviceId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing deviceId',
      });
    }

    const { result, limit, offset } = c.req.valid('query');

    const conditions = [eq(accessLog.deviceId, deviceId)];
    if (result) {
      conditions.push(eq(accessLog.result, result));
    }

    const logs = await db
      .select({
        id: accessLog.id,
        deviceId: accessLog.deviceId,
        deviceName: device.name,
        tag: accessLog.tag,
        cardId: accessLog.cardId,
        cardLabel: card.label,
        userId: accessLog.userId,
        userName: user.name,
        result: accessLog.result,
        reason: accessLog.reason,
        timestamp: accessLog.timestamp,
      })
      .from(accessLog)
      .leftJoin(device, eq(accessLog.deviceId, device.id))
      .leftJoin(card, eq(accessLog.cardId, card.id))
      .leftJoin(user, eq(accessLog.userId, user.id))
      .where(and(...conditions))
      .orderBy(desc(accessLog.timestamp))
      .limit(limit)
      .offset(offset);

    return c.json<SuccessResponse>({
      success: true,
      data: logs,
    });
  }
);
