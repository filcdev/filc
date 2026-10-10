import {
  type WifiStatsOverview,
  wifiStatsOverviewSchema,
} from '@filcdev/api/domains/wifi/stats';
import { count, gte, sql } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { wifiAuthLog, wifiDevice, wifiUser } from '#database/schema/wifi';
import { authRouter } from '#middleware/auth';
import { ok } from '#utils/http';
import { filcExt } from '#utils/openapi';
import { wifiFactory } from './_factory';

const response = (
  schema: Parameters<typeof resolver>[0],
  description: string
) => ({
  200: {
    content: {
      'application/json': { schema: resolver(schema) },
    },
    description,
  },
});

export const wifiStatsRoute = wifiFactory.createHandlers(
  describeRoute({
    ...filcExt('WiFi', '@unit WifiStatsResponse @field(.stats, WifiStats)'),
    description:
      'Get WiFi account, device, active-device, and auth statistics.',
    responses: response(wifiStatsOverviewSchema, 'WiFi statistics'),
    tags: ['WiFi'],
  }),
  ...authRouter('wifi:read'),
  async (c) => {
    const activeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [users, devices, activeDevices] = await Promise.all([
      db.select({ count: count() }).from(wifiUser),
      db.select({ count: count() }).from(wifiDevice),
      db
        .select({ count: count() })
        .from(wifiDevice)
        .where(gte(wifiDevice.lastActiveAt, activeSince)),
    ]);

    const day = sql<string>`date_trunc('day', ${wifiAuthLog.timestamp})`;
    const rows = await db
      .select({
        accepted: sql<number>`count(*) filter (where ${wifiAuthLog.result} = true)`,
        date: sql<string>`to_char(${day}, 'YYYY-MM-DD')`,
        rejected: sql<number>`count(*) filter (where ${wifiAuthLog.result} = false)`,
      })
      .from(wifiAuthLog)
      .where(
        gte(
          wifiAuthLog.timestamp,
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        )
      )
      .groupBy(day)
      .orderBy(day);

    const stats: WifiStatsOverview = {
      activeDevices: Number(activeDevices[0]?.count ?? 0),
      authSeries: rows.map((row) => ({
        accepted: Number(row.accepted),
        date: row.date,
        rejected: Number(row.rejected),
      })),
      totalDevices: Number(devices[0]?.count ?? 0),
      totalUsers: Number(users[0]?.count ?? 0),
    };
    return ok(c, stats);
  }
);
