import z from 'zod';

/** A period definition: `startTime`/`endTime` are `time` columns. */
export const periodSelectSchema = z.object({
  endTime: z.string(),
  id: z.uuid(),
  period: z.number(),
  startTime: z.string(),
});

export const getPeriodsQuerySchema = z.object({
  timetableId: z.uuid().optional(),
});

export type GetPeriodsQueryInput = z.infer<typeof getPeriodsQuerySchema>;
