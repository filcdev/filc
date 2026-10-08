import { permissions } from '@filcdev/api/permissions';
import { count, gte, sql } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { requireWifiEnabled } from '#middleware/wifi';
import { base } from '#orpc';
import { wifiAuthLog, wifiDevice, wifiUser } from './schema';

const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const SERIES_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const wifiStats = base.wifi.stats.overview
  .use(requireWifiEnabled)
  .use(requireAuthorization(permissions.wifiRead))
  .handler(async () => {
    const [users, devices, activeDevices] = await Promise.all([
      db.select({ count: count() }).from(wifiUser),
      db.select({ count: count() }).from(wifiDevice),
      db
        .select({ count: count() })
        .from(wifiDevice)
        .where(
          gte(wifiDevice.lastActiveAt, new Date(Date.now() - ACTIVE_WINDOW_MS))
        ),
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
        gte(wifiAuthLog.timestamp, new Date(Date.now() - SERIES_WINDOW_MS))
      )
      .groupBy(day)
      .orderBy(day);

    return {
      activeDevices: Number(activeDevices[0]?.count ?? 0),
      authSeries: rows.map((row) => ({
        accepted: Number(row.accepted),
        date: row.date,
        rejected: Number(row.rejected),
      })),
      totalDevices: Number(devices[0]?.count ?? 0),
      totalUsers: Number(users[0]?.count ?? 0),
    };
  });
