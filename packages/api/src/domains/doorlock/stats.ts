import z from 'zod';

/** Aggregated doorlock statistics response payload. */
export const statsResponseSchema = z.object({
  data: z.object({
    stats: z.object({
      doorOpenSeries: z.array(
        z.object({
          count: z.number().int(),
          date: z.string(),
        })
      ),
      topUsers: z.array(
        z.object({
          count: z.number().int(),
          id: z.string(),
          name: z.string().nullable(),
          nickname: z.string().nullable(),
        })
      ),
      totalCards: z.number().int(),
      totalDevices: z.number().int(),
      totalSuccessfulOpens: z.number().int(),
    }),
  }),
  success: z.literal(true),
});

/** Device health statistics response payload. */
export const deviceStatsResponseSchema = z.object({
  data: z.object({
    stats: z.array(
      z.object({
        debug: z.object({
          deviceState: z.enum(['booting', 'error', 'idle', 'updating']),
          errors: z.object({
            db: z.boolean(),
            nfc: z.boolean(),
            ota: z.boolean(),
            sd: z.boolean(),
            wifi: z.boolean(),
          }),
          lastResetReason: z.string(),
        }),
        fwVersion: z.string(),
        id: z.number(),
        ramFree: z.number(),
        storage: z.object({
          total: z.number(),
          used: z.number(),
        }),
        timestamp: z.date(),
        uptime: z.number(),
      })
    ),
  }),
  success: z.literal(true),
});

export type DoorlockStatsOverview = z.infer<
  typeof statsResponseSchema
>['data']['stats'];
