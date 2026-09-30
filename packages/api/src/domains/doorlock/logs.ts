import z from 'zod';
import { doorlockUserSummarySchema } from './cards';

/** Query parameters for listing doorlock audit log entries. */
export const logsQuerySchema = z.object({
  cardId: z.uuid().optional(),
  deviceId: z.uuid().optional(),
  from: z.iso.datetime().optional(),
  granted: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  search: z.string().optional(),
  to: z.iso.datetime().optional(),
  userId: z.uuid().optional(),
});

export type LogsQueryInput = z.infer<typeof logsQuerySchema>;

/** An audit log row. */
export const doorlockAuditLogSchema = z.object({
  buttonPressed: z.boolean(),
  cardData: z.string().nullable(),
  cardId: z.uuid().nullable(),
  deviceId: z.uuid(),
  id: z.number().int(),
  result: z.boolean(),
  timestamp: z.date(),
  userId: z.uuid().nullable(),
});

/** An audit log row with its resolved device, card and owner. */
export const doorlockLogEntrySchema = doorlockAuditLogSchema.extend({
  card: z.object({ id: z.uuid(), name: z.string() }).nullable().optional(),
  device: z.object({ id: z.uuid(), name: z.string() }).nullable().optional(),
  owner: doorlockUserSummarySchema.nullable().optional(),
});

/** Payload of `GET /doorlock/logs`. */
export const doorlockLogListResponseSchema = z.object({
  logs: z.array(doorlockLogEntrySchema),
});
