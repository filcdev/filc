import { getLogger } from '@logtape/logtape';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '~/database';
import { user } from '~/database/schema/authentication';
import { auditLog, card, device } from '~/database/schema/doorlock';
import type { SuccessResponse } from '~/utils/globals';
import {
  requireAuthentication,
  requireAuthorization,
} from '~/utils/middleware';
import { ensureJsonSafeDates } from '~/utils/zod';
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
        })
      ),
      totalCards: z.number().int(),
      totalDevices: z.number().int(),
      totalSuccessfulOpens: z.number().int(),
    }),
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
        })
        .from(auditLog)
        .leftJoin(user, eq(auditLog.userId, user.id))
        .where(
          and(eq(auditLog.result, true), sql`${auditLog.userId} IS NOT NULL`)
        )
        .groupBy(auditLog.userId, user.name)
        .orderBy(desc(userSuccessCount))
        .limit(3);

      const topUsers = topUsersRows
        .filter((row) => row.id)
        .map((row) => ({
          count: Number(row.count),
          id: row.id as string,
          name: row.name ?? 'Unknown user',
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
