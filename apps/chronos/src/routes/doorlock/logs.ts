import type { SQL } from 'drizzle-orm';
import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { auditLog, card, device } from '#database/schema/doorlock';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { ensureJsonSafeDates } from '#utils/zod';
import { doorlockFactory } from './_factory';

const auditLogSelectSchema = createSelectSchema(auditLog);
const deviceSummarySchema = createSelectSchema(device).pick({
  id: true,
  name: true,
});
const cardSummarySchema = createSelectSchema(card).pick({
  id: true,
  name: true,
});
const userSummarySchema = z.object({
  email: z.string().nullable(),
  id: z.uuid(),
  name: z.string().nullable(),
  nickname: z.string().nullable(),
});

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

const logsResponseSchema = z.object({
  data: z.object({
    logs: z.array(
      auditLogSelectSchema.extend({
        card: cardSummarySchema.nullable().optional(),
        device: deviceSummarySchema.nullable().optional(),
        owner: userSummarySchema.nullable().optional(),
      })
    ),
  }),
  success: z.literal(true),
});

const logsQuerySchema = z.object({
  cardId: z.uuid().optional(),
  deviceId: z.uuid().optional(),
  from: z.string().datetime().optional(),
  granted: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  search: z.string().optional(),
  to: z.string().datetime().optional(),
  userId: z.uuid().optional(),
});

type LogQuery = z.infer<typeof logsQuerySchema>;

const appendBaseFilters = (filters: SQL<unknown>[], query: LogQuery) => {
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

const appendSearchFilters = (query: LogQuery) => {
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

const buildWhereClause = (query: LogQuery): SQL<unknown> | undefined => {
  const filters: SQL<unknown>[] = [];

  appendBaseFilters(filters, query);
  filters.push(appendSearchFilters(query) as SQL);

  if (!filters.length) {
    return;
  }

  let combined: SQL<unknown> | undefined;
  for (const clause of filters) {
    combined = combined ? and(combined, clause) : clause;
  }
  return combined;
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

export const listLogsRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'List audit log entries',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(logsResponseSchema)),
          },
        },
        description: 'Successful response',
      },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:logs:read'),
  async (c) => {
    const url = new URL(c.req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const query = logsQuerySchema.parse(queryParams);

    const rows = await db
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
      .where(buildWhereClause(query))
      .orderBy(desc(auditLog.timestamp))
      .limit(query.limit);

    const logs = mapRowsToLogs(rows);

    return c.json<SuccessResponse<{ logs: DoorlockLogEntry[] }>>({
      data: { logs },
      success: true,
    });
  }
);
