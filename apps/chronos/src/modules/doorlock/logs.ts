import type { LogsQueryInput } from '@filcdev/api/domains/doorlock/logs';
import { permissions } from '@filcdev/api/permissions';
import type { SQL } from 'drizzle-orm';
import { count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthorization } from '#middleware/auth';
import { auditLog, card, device } from '#modules/doorlock/schema';
import { base } from '#orpc';
import { andAll } from '#utils/drizzle';

type DeviceSummary = Pick<typeof device.$inferSelect, 'id' | 'name'>;
type CardSummary = Pick<typeof card.$inferSelect, 'id' | 'name'>;
type UserSummary = Pick<
  typeof user.$inferSelect,
  'id' | 'name' | 'email' | 'nickname'
>;

export type DoorlockLogEntry = typeof auditLog.$inferSelect & {
  device?: DeviceSummary | null;
  card?: CardSummary | null;
  owner?: UserSummary | null;
};

const appendBaseFilters = (filters: SQL<unknown>[], query: LogsQueryInput) => {
  if (query.cardId) {
    filters.push(eq(auditLog.cardId, query.cardId));
  }
  if (query.deviceId) {
    filters.push(eq(auditLog.deviceId, query.deviceId));
  }
  if (query.userId) {
    filters.push(eq(auditLog.userId, query.userId));
  }
  if (typeof query.granted === 'boolean') {
    filters.push(eq(auditLog.result, query.granted));
  }
  if (query.from) {
    filters.push(gte(auditLog.timestamp, new Date(query.from)));
  }
  if (query.to) {
    filters.push(lte(auditLog.timestamp, new Date(query.to)));
  }
};

const appendSearchFilters = (query: LogsQueryInput) => {
  const { search: searchTerm } = query;
  if (!searchTerm) {
    return;
  }

  const pattern = `%${searchTerm}%`;

  return or(
    ilike(device.name, pattern),
    ilike(card.name, pattern),
    ilike(user.name, pattern),
    ilike(user.nickname, pattern),
    ilike(auditLog.cardData, pattern)
  );
};

const buildWhereClause = (query: LogsQueryInput): SQL<unknown> | undefined => {
  const filters: SQL<unknown>[] = [];

  appendBaseFilters(filters, query);
  const filter = appendSearchFilters(query);
  if (filter) {
    filters.push(filter);
  }

  return andAll(filters);
};

const mapRowsToLogs = (
  rows: Array<{
    buttonPressed: boolean;
    cardData: string | null;
    cardId: string | null;
    deviceId: string;
    id: number;
    logCardId: string | null;
    logCardName: string | null;
    logDeviceId: string | null;
    logDeviceName: string | null;
    ownerEmail: string | null;
    ownerId: string | null;
    ownerName: string | null;
    ownerNickname: string | null;
    result: boolean;
    timestamp: Date;
    userId: string | null;
  }>
) =>
  rows.map<DoorlockLogEntry>((row) => ({
    buttonPressed: row.buttonPressed,
    card: row.logCardId
      ? { id: row.logCardId, name: row.logCardName ?? 'Unknown card' }
      : null,
    cardData: row.cardData,
    cardId: row.cardId,
    device: row.logDeviceId
      ? { id: row.logDeviceId, name: row.logDeviceName ?? 'Unknown device' }
      : null,
    deviceId: row.deviceId,
    id: row.id,
    owner: row.ownerId
      ? {
          email: row.ownerEmail ?? 'unknown@example.com',
          id: row.ownerId,
          name: row.ownerName ?? 'Unknown user',
          nickname: row.ownerNickname,
        }
      : null,
    result: row.result,
    timestamp: row.timestamp,
    userId: row.userId,
  }));

export const listLogs = base.doorlock.logs.list
  .use(requireAuthorization(permissions.doorlockLogsRead))
  .handler(async ({ input: query }) => {
    const where = buildWhereClause(query);
    // `total` is the unpaged count: the endpoint caps at `limit`, so the page
    // length would hide how much more there is.
    const [rows, totalResult] = await Promise.all([
      db
        .select({
          buttonPressed: auditLog.buttonPressed,
          cardData: auditLog.cardData,
          cardId: auditLog.cardId,
          deviceId: auditLog.deviceId,
          id: auditLog.id,
          logCardId: card.id,
          logCardName: card.name,
          logDeviceId: device.id,
          logDeviceName: device.name,
          ownerEmail: user.email,
          ownerId: user.id,
          ownerName: user.name,
          ownerNickname: user.nickname,
          result: auditLog.result,
          timestamp: auditLog.timestamp,
          userId: auditLog.userId,
        })
        .from(auditLog)
        .leftJoin(device, eq(auditLog.deviceId, device.id))
        .leftJoin(card, eq(auditLog.cardId, card.id))
        .leftJoin(user, eq(auditLog.userId, user.id))
        .where(where)
        .orderBy(desc(auditLog.timestamp))
        .limit(query.limit),
      db.select({ count: count() }).from(auditLog).where(where),
    ]);

    const logs = mapRowsToLogs(rows);

    return { items: logs, total: totalResult[0]?.count ?? 0 };
  });
