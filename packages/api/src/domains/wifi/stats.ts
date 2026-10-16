import z from 'zod';

export const wifiAuthSeriesPointSchema = z.object({
  accepted: z.number().int(),
  date: z.string(),
  rejected: z.number().int(),
});

export const wifiStatsOverviewSchema = z.object({
  activeDevices: z.number().int(),
  authSeries: z.array(wifiAuthSeriesPointSchema),
  totalDevices: z.number().int(),
  totalUsers: z.number().int(),
});

export type WifiStatsOverview = z.infer<typeof wifiStatsOverviewSchema>;
