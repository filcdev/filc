import type {
  DeviceHealthStat,
  DoorlockStatsOverview,
} from '@filcdev/api/domains/doorlock/stats';
import { permissions } from '@filcdev/api/permissions';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthorization } from '#middleware/auth';
import { auditLog, card, device, deviceHealth } from '#modules/doorlock/schema';
import { base } from '#orpc';

const sevenDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date;
};

export const doorlockStats = base.doorlock.stats.overview
  .use(requireAuthorization(permissions.doorlockStatsRead))
  .handler(async () => {
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
        and(eq(auditLog.result, true), gte(auditLog.timestamp, sevenDaysAgo()))
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

    return { stats };
  });

export const deviceStats = base.doorlock.devices.stats
  .use(requireAuthorization(permissions.doorlockStatsRead))
  .handler(async ({ input }) => {
    const deviceId = input.id;

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
    const formattedStats: DeviceHealthStat[] = stats.map((stat) => ({
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

    return formattedStats;
  });
