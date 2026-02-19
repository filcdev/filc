import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import {
  auditLog,
  card,
  device,
  deviceHealth,
} from '#database/schema/doorlock';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { ensureJsonSafeDates } from '#utils/zod';
import { doorlockFactory } from './_factory';

const logger = getLogger(['chronos', 'doorlock', 'stats']);

const statsResponseSchema = z.object({
  data: z.object({
    stats: z.object({
      doorOpenSeries: z.array(
        z.object({
          count: z.number().int(),
          date: z.string(),
        })
      ),
      topUsers: z.array(
        z.object({
          count: z.number().int(),
          id: z.string(),
          name: z.string().nullable(),
          nickname: z.string().nullable(),
        })
      ),
      totalCards: z.number().int(),
      totalDevices: z.number().int(),
      totalSuccessfulOpens: z.number().int(),
    }),
  }),
  success: z.literal(true),
});

const deviceStatsResponseSchema = z.object({
  data: z.object({
    stats: z.array(
      z.object({
        debug: z.object({
          deviceState: z.enum(['booting', 'error', 'idle', 'updating']),
          errors: z.object({
            db: z.boolean(),
            nfc: z.boolean(),
            ota: z.boolean(),
            sd: z.boolean(),
            wifi: z.boolean(),
          }),
          lastResetReason: z.string(),
        }),
        fwVersion: z.string(),
        id: z.number(),
        ramFree: z.number(),
        storage: z.object({
          total: z.number(),
          used: z.number(),
        }),
        timestamp: z.date(),
        uptime: z.number(),
      })
    ),
  }),
  success: z.literal(true),
});

type DoorlockStatsOverview = z.infer<
  typeof statsResponseSchema
>['data']['stats'];

const sevenDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date;
};

export const doorlockStatsRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Get aggregated doorlock statistics',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(statsResponseSchema)),
          },
        },
        description: 'Successful response',
      },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:stats:read'),
  async (c) => {
    try {
      const cardCount = count(card.id);
      const deviceCount = count(device.id);
      const successCount = count(auditLog.id);

      const totalCardsRow = await db.select({ count: cardCount }).from(card);
      const totalDevicesRow = await db
        .select({ count: deviceCount })
        .from(device);
      const totalSuccessfulOpensRow = await db
        .select({ count: successCount })
        .from(auditLog)
        .where(eq(auditLog.result, true));

      const dayBucket = sql<string>`date_trunc('day', ${auditLog.timestamp})`;
      const dayBucketLabel = sql<string>`to_char(${dayBucket}, 'YYYY-MM-DD')`;
      const dailyCount = count(auditLog.id);

      const doorOpenSeriesRows = await db
        .select({
          count: dailyCount,
          date: dayBucketLabel,
        })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.result, true),
            gte(auditLog.timestamp, sevenDaysAgo())
          )
        )
        .groupBy(dayBucket)
        .orderBy(dayBucket);

      const doorOpenSeries = doorOpenSeriesRows.map((row) => ({
        count: Number(row.count),
        date: row.date,
      }));

      const userSuccessCount = count(auditLog.id);
      const topUsersRows = await db
        .select({
          count: userSuccessCount,
          id: auditLog.userId,
          name: user.name,
          nickname: user.nickname,
        })
        .from(auditLog)
        .leftJoin(user, eq(auditLog.userId, user.id))
        .where(
          and(eq(auditLog.result, true), sql`${auditLog.userId} IS NOT NULL`)
        )
        .groupBy(auditLog.userId, user.name, user.nickname)
        .orderBy(desc(userSuccessCount))
        .limit(3);

      const topUsers = topUsersRows
        .filter((row) => row.id)
        .map((row) => ({
          count: Number(row.count),
          id: row.id as string,
          name: row.name ?? 'Unknown user',
          nickname: row.nickname,
        }));

      const stats: DoorlockStatsOverview = {
        doorOpenSeries,
        topUsers,
        totalCards: Number(totalCardsRow[0]?.count ?? 0),
        totalDevices: Number(totalDevicesRow[0]?.count ?? 0),
        totalSuccessfulOpens: Number(totalSuccessfulOpensRow[0]?.count ?? 0),
      };

      return c.json<SuccessResponse<{ stats: DoorlockStatsOverview }>>({
        data: { stats },
        success: true,
      });
    } catch (error) {
      logger.error('Failed to fetch doorlock stats', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch doorlock stats',
      });
    }
  }
);

export const deviceStatsRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Get device health statistics',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(deviceStatsResponseSchema)),
          },
        },
        description: 'Successful response',
      },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:stats:read'),
  zValidator('param', z.object({ id: z.uuid() })),
  async (c) => {
    const { id: deviceId } = c.req.valid('param');

    const stats = await db
      .select({
        deviceMeta: deviceHealth.deviceMeta,
        id: deviceHealth.id,
        timestamp: deviceHealth.timestamp,
      })
      .from(deviceHealth)
      .where(eq(deviceHealth.deviceId, deviceId))
      .orderBy(desc(deviceHealth.timestamp))
      .limit(100);

    // map bigint to number for JSON serialization
    const formattedStats = stats.map((stat) => ({
      ...stat,
      deviceMeta: {
        ...stat.deviceMeta,
        ramFree: Number(stat.deviceMeta.ramFree),
        storage: {
          total: Number(stat.deviceMeta.storage.total),
          used: Number(stat.deviceMeta.storage.used),
        },
        uptime: Number(stat.deviceMeta.uptime),
      },
    }));

    return c.json<SuccessResponse<typeof formattedStats>>({
      data: formattedStats,
      success: true,
    });
  }
);
