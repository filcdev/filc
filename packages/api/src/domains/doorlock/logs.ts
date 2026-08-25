import z from 'zod';

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
