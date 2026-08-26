import z from 'zod';

/** Query parameters for exporting doorlock audit log entries as CSV. */
export const exportQuerySchema = z.object({
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

export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
