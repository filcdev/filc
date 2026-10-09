import z from 'zod';

/** One health report a doorlock device sent over its socket. */
export const deviceHealthStatSchema = z.object({
  deviceMeta: z.object({
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
    ramFree: z.number(),
    storage: z.object({
      total: z.number(),
      used: z.number(),
    }),
    uptime: z.number(),
  }),
  id: z.number().int(),
  timestamp: z.date(),
});

export type DeviceHealthStat = z.infer<typeof deviceHealthStatSchema>;

/** Payload of `GET /doorlock/devices/{id}/stats`: the latest 100 reports, newest first. */
export const deviceStatsPayloadSchema = z.array(deviceHealthStatSchema);

/** Aggregated doorlock statistics. */
export const doorlockStatsSchema = z.object({
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
});

/** Payload of `GET /doorlock/stats/overview`. */
export const doorlockStatsResponseSchema = z.object({
  stats: doorlockStatsSchema,
});

export type DoorlockStatsOverview = z.infer<typeof doorlockStatsSchema>;
