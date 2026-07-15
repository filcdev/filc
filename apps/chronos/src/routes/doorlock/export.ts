import type { SQL } from 'drizzle-orm';
import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { describeRoute } from 'hono-openapi';
import z from 'zod';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { auditLog, card, device } from '#database/schema/doorlock';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { filcExt } from '#utils/openapi';
import { doorlockFactory } from './_factory';

const exportQuerySchema = z.object({
  cardId: z.uuid().optional(),
  deviceId: z.uuid().optional(),
  from: z.iso.datetime().optional(),
  granted: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  search: z.string().optional(),
  to: z.iso.datetime().optional(),
  userId: z.uuid().optional(),
});

type ExportQuery = z.infer<typeof exportQuerySchema>;

const appendBaseFilters = (filters: SQL<unknown>[], query: ExportQuery) => {
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

const appendSearchFilters = (query: ExportQuery) => {
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

const buildWhereClause = (query: ExportQuery): SQL<unknown> | undefined => {
  const filters: SQL<unknown>[] = [];

  appendBaseFilters(filters, query);
  const filter = appendSearchFilters(query);
  if (filter) {
    filters.push(filter);
  }

  if (!filters.length) {
    return;
  }

  let combined: SQL<unknown> | undefined;
  for (const clause of filters) {
    combined = combined ? and(combined, clause) : clause;
  }
  return combined;
};

const CSV_SPECIAL_CHARS = /[",\n\r]/;
const CSV_QUOTE = /"/g;

const escapeCsvField = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (CSV_SPECIAL_CHARS.test(str)) {
    return `"${str.replace(CSV_QUOTE, '""')}"`;
  }
  return str;
};

const getTriggeredBy = (row: {
  buttonPressed: boolean;
  cardId: string | null;
}): string => {
  if (row.buttonPressed) {
    return row.cardId ? 'Virtual card' : 'Physical button';
  }
  return 'Card swipe';
};

const toCsv = (
  rows: Array<{
    timestamp: Date;
    deviceName: string | null;
    ownerName: string | null;
    ownerNickname: string | null;
    ownerEmail: string | null;
    cardName: string | null;
    cardData: string | null;
    cardId: string | null;
    buttonPressed: boolean;
    result: boolean;
  }>
): string => {
  const header = [
    'timestamp',
    'device',
    'user',
    'card',
    'card_uid',
    'triggered_by',
    'result',
  ];

  const lines = rows.map((row) => {
    const triggeredBy = getTriggeredBy(row);
    return [
      row.timestamp.toISOString(),
      row.deviceName,
      row.ownerNickname || row.ownerName || row.ownerEmail || '',
      row.cardName,
      row.cardData,
      triggeredBy,
      row.result ? 'granted' : 'denied',
    ]
      .map(escapeCsvField)
      .join(',');
  });

  return [header.join(','), ...lines].join('\n');
};

export const exportLogsRoute = doorlockFactory.createHandlers(
  describeRoute({
    ...filcExt('Doorlock', 'Export audit log entries as CSV', true),
    description:
      'Export doorlock audit log entries (attendance data) as a CSV file over an optional date range.',
    responses: {
      200: {
        content: {
          'text/csv': {
            schema: { format: 'binary', type: 'string' },
          },
        },
        description: 'CSV file with the requested log entries',
      },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:logs:read'),
  async (c) => {
    const url = new URL(c.req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const query = exportQuerySchema.parse(queryParams);

    const rows = await db
      .select({
        buttonPressed: auditLog.buttonPressed,
        cardData: auditLog.cardData,
        cardId: auditLog.cardId,
        cardName: card.name,
        deviceName: device.name,
        ownerEmail: user.email,
        ownerName: user.name,
        ownerNickname: user.nickname,
        result: auditLog.result,
        timestamp: auditLog.timestamp,
      })
      .from(auditLog)
      .leftJoin(device, eq(auditLog.deviceId, device.id))
      .leftJoin(card, eq(auditLog.cardId, card.id))
      .leftJoin(user, eq(auditLog.userId, user.id))
      .where(buildWhereClause(query))
      .orderBy(desc(auditLog.timestamp));

    const csv = toCsv(
      rows.map((row) => ({
        ...row,
        cardName: row.cardId ? (row.cardName ?? 'Unknown card') : null,
        deviceName: row.deviceName ?? 'Unknown device',
        ownerName: row.ownerName ?? 'Unknown user',
      }))
    );

    const filename = `doorlock-export-${new Date().toISOString().slice(0, 10)}.csv`;

    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);

    return c.body(csv);
  }
);
