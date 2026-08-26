import z from 'zod';

/** Query parameters for dashboard statistics. */
export const statsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type StatsQueryInput = z.infer<typeof statsQuerySchema>;

/** A single day of substitution/moved-lesson activity. */
export const chartPointSchema = z.object({
  date: z.string(),
  movedLessons: z.number().int(),
  substitutions: z.number().int(),
});

/** Aggregated dashboard statistics response payload. */
export const dashboardStatsResponseSchema = z.object({
  data: z.object({
    stats: z.object({
      chartData: z.array(chartPointSchema),
      chartTotalMovedLessons: z.number().int(),
      chartTotalSubstitutions: z.number().int(),
      totalCohorts: z.number().int(),
      totalMovedLessons: z.number().int(),
      totalRoles: z.number().int(),
      totalSubstitutions: z.number().int(),
      totalUsers: z.number().int(),
    }),
  }),
  success: z.literal(true),
});
