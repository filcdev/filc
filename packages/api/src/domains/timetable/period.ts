import z from 'zod';

export const getPeriodsResponseSchema = z.object({
  data: z
    .object({
      endTime: z.string(),
      id: z.string(),
      period: z.number(),
      startTime: z.string(),
    })
    .array(),
  success: z.boolean(),
});

export type GetPeriodsResponse = z.infer<typeof getPeriodsResponseSchema>;

export const getPeriodsQuerySchema = z.object({
  timetableId: z.string().uuid().optional(),
});

export type GetPeriodsQueryInput = z.infer<typeof getPeriodsQuerySchema>;
