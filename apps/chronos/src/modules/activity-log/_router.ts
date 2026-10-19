import { permissions } from '@filcdev/api/permissions';
import { count, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthorization } from '#middleware/auth';
import { activityLog } from '#modules/activity-log/schema';
import { base } from '#orpc';
import { andAll } from '#utils/drizzle';

export type ActivityLogEntry = typeof activityLog.$inferSelect & {
  actor: {
    email: string | null;
    id: string;
    name: string | null;
    nickname: string | null;
  } | null;
};

export const listActivityLog = base.activityLog.list
  .use(requireAuthorization(permissions.activityLogRead))
  .handler(async ({ input: query }) => {
    const filters: SQL<unknown>[] = [];

    if (query.actorId) {
      filters.push(eq(activityLog.actorId, query.actorId));
    }
    if (query.action) {
      filters.push(eq(activityLog.action, query.action));
    }
    if (query.entityType) {
      filters.push(eq(activityLog.entityType, query.entityType));
    }
    if (query.from) {
      filters.push(gte(activityLog.createdAt, query.from));
    }
    if (query.to) {
      filters.push(lte(activityLog.createdAt, query.to));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      const search = or(
        ilike(activityLog.action, pattern),
        ilike(activityLog.entityType, pattern),
        ilike(activityLog.entityId, pattern),
        ilike(user.name, pattern),
        ilike(user.email, pattern)
      );
      if (search) {
        filters.push(search);
      }
    }
    const where = andAll(filters);

    // `total` is the unpaged count, like every other list endpoint.
    const [rows, total] = await Promise.all([
      db
        .select({
          action: activityLog.action,
          actorEmail: user.email,
          actorId: activityLog.actorId,
          actorName: user.name,
          actorNickname: user.nickname,
          createdAt: activityLog.createdAt,
          entityId: activityLog.entityId,
          entityType: activityLog.entityType,
          id: activityLog.id,
          ipAddress: activityLog.ipAddress,
          metadata: activityLog.metadata,
          userAgent: activityLog.userAgent,
        })
        .from(activityLog)
        .leftJoin(user, eq(activityLog.actorId, user.id))
        .where(where)
        .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: count() }).from(activityLog).where(where),
    ]);

    const items: ActivityLogEntry[] = rows.map((row) => ({
      action: row.action,
      actor: row.actorId
        ? {
            email: row.actorEmail ?? null,
            id: row.actorId,
            name: row.actorName ?? null,
            nickname: row.actorNickname ?? null,
          }
        : null,
      actorId: row.actorId,
      createdAt: row.createdAt,
      entityId: row.entityId,
      entityType: row.entityType,
      id: row.id,
      ipAddress: row.ipAddress,
      metadata: row.metadata,
      userAgent: row.userAgent,
    }));

    return { items, total: total[0]?.count ?? 0 };
  });

export const activityLogRouter = {
  list: listActivityLog,
};
