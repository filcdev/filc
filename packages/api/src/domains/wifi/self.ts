import z from 'zod';

export const wifiSelfDeviceSchema = z.object({
  banned: z.boolean(),
  id: z.uuid(),
  lastActiveAt: z.iso.datetime().nullable(),
  macAddress: z.string(),
  nickname: z.string().nullable(),
  reportedHostname: z.string().nullable(),
});

export const wifiSpeedLimitInfoSchema = z.object({
  downloadSpeedMbps: z.number().int().nullable(),
  roleName: z.string().nullable(),
  source: z.enum(['override', 'role', 'wlan_default']),
  speedProfileId: z.string().nullable(),
  uploadSpeedMbps: z.number().int().nullable(),
});

export const wifiSelfSchema = z.object({
  banned: z.boolean(),
  devices: z.array(wifiSelfDeviceSchema),
  speedLimit: wifiSpeedLimitInfoSchema,
  username: z.string(),
});

export const wifiSelfDeviceUpdateSchema = z.object({
  nickname: z
    .string()
    .max(100)
    .nullable()
    .transform((v) => (v === '' ? null : v)),
});

export const wifiSelfPasswordChangeSchema = z.object({
  newPassword: z.string().min(1),
});

export const wifiSelfPasswordChangeResponseSchema = z.object({
  success: z.boolean(),
});

export const wifiSelfCreateSchema = z.object({
  password: z.string().min(1),
});

export const wifiSelfCreateResponseSchema = z.object({
  wifi: wifiSelfSchema,
});

export type WifiSelf = z.infer<typeof wifiSelfSchema>;
export type WifiSelfDevice = z.infer<typeof wifiSelfDeviceSchema>;
export type WifiSpeedLimitInfo = z.infer<typeof wifiSpeedLimitInfoSchema>;
export type WifiSelfPasswordChange = z.infer<
  typeof wifiSelfPasswordChangeSchema
>;
export type WifiSelfPasswordChangeResponse = z.infer<
  typeof wifiSelfPasswordChangeResponseSchema
>;
export type WifiSelfCreate = z.infer<typeof wifiSelfCreateSchema>;
export type WifiSelfCreateResponse = z.infer<
  typeof wifiSelfCreateResponseSchema
>;
