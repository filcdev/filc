import z from 'zod';

export const wifiStatusResponseSchema = z.object({
  enabled: z.boolean(),
  ssid: z.string().nullable(),
});

export type WifiStatusResponse = z.infer<typeof wifiStatusResponseSchema>;
