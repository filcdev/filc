import z from 'zod';

const macRegex = /^([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})$/i;
const macAddressSchema = z.string().regex(macRegex, 'Invalid MAC address');

export const wifiIdParamSchema = z.object({ id: z.uuid() });
export const wifiStringIdParamSchema = z.object({ id: z.string().min(1) });
export const wifiListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10_000).default(10_000),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
});

export const wifiDeviceListQuerySchema = wifiListQuerySchema.extend({
  wifiUserId: z
    .union([z.uuid(), z.literal('null'), z.literal('')])
    .transform((val) => (val === 'null' || val === '' ? null : val))
    .optional(),
});

export const wifiUserSchema = z.object({
  allowedMacAddresses: z.array(macAddressSchema).nullable(),
  banned: z.boolean(),
  comment: z.string().nullable(),
  createdAt: z.iso.datetime(),
  createdBy: z.uuid().nullable(),
  creatorName: z.string().nullable().optional(),
  id: z.uuid(),
  lastActiveAt: z.iso.datetime().nullable(),
  speedProfileId: z.string().nullable(),
  updatedAt: z.iso.datetime(),
  userId: z.uuid().nullable(),
  username: z.string(),
});

export const wifiDeviceSchema = z.object({
  adminNotes: z.string().nullable(),
  banned: z.boolean(),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  lastActiveAt: z.iso.datetime().nullable(),
  macAddress: macAddressSchema,
  nickname: z.string().nullable(),
  reportedHostname: z.string().nullable(),
  updatedAt: z.iso.datetime(),
  wifiUserId: z.uuid().nullable(),
});

export const wifiNasSchema = z.object({
  comment: z.string().nullable(),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  ipAddress: z.string(),
  macAddress: macAddressSchema,
  updatedAt: z.iso.datetime(),
});

export const wifiSpeedProfileSchema = z.object({
  downloadSpeedMbps: z.number().int().nullable(),
  id: z.string(),
  isWlanDefault: z.boolean(),
  name: z.string(),
  uploadSpeedMbps: z.number().int().nullable(),
});

export const wifiRoleSpeedProfileSchema = z.object({
  downloadSpeedMbps: z.number().int().nullable(),
  priority: z.number().int(),
  roleName: z.string(),
  speedProfileId: z.string(),
  uploadSpeedMbps: z.number().int().nullable(),
});

export const wifiUserCreateSchema = z.object({
  allowedMacAddresses: z.array(macAddressSchema).optional(),
  comment: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
  password: z.string().min(1),
  speedProfileId: z.string().nullable().optional(),
  userId: z.uuid().nullable().optional(),
  username: z.string().min(1),
});

export const wifiUserUpdateSchema = wifiUserCreateSchema.partial().extend({
  banned: z.boolean().optional(),
  password: z
    .union([z.string().min(1), z.literal('')])
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
});

export const wifiDeviceCreateSchema = z.object({
  adminNotes: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
  banned: z.boolean().optional(),
  macAddress: macAddressSchema,
  nickname: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
  wifiUserId: z.uuid().nullable().optional(),
});

export const wifiDeviceUpdateSchema = wifiDeviceCreateSchema.partial();

export const wifiNasCreateSchema = z.object({
  comment: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
  ipAddress: z.string(),
  macAddress: macAddressSchema,
});

export const wifiNasUpdateSchema = wifiNasCreateSchema.partial();

export const wifiSpeedProfileCreateSchema = z.object({
  downloadSpeedMbps: z.number().int().min(-1).default(-1),
  name: z.string().min(1),
  uploadSpeedMbps: z.number().int().min(-1).default(-1),
});

export const wifiSpeedProfileUpdateSchema =
  wifiSpeedProfileCreateSchema.partial();

export const wifiRoleSpeedProfileCreateSchema = z.object({
  downloadSpeedMbps: z.number().int().nullable().optional(),
  priority: z.number().int().default(0),
  roleName: z.string().min(1),
  speedProfileId: z.string().min(1),
  uploadSpeedMbps: z.number().int().nullable().optional(),
});

export const wifiRoleSpeedProfileUpdateSchema =
  wifiRoleSpeedProfileCreateSchema.partial();

export type WifiListQuery = z.infer<typeof wifiListQuerySchema>;
export type WifiDeviceListQuery = z.infer<typeof wifiDeviceListQuerySchema>;

export type WifiUser = z.infer<typeof wifiUserSchema>;
export type WifiDevice = z.infer<typeof wifiDeviceSchema>;
export type WifiNas = z.infer<typeof wifiNasSchema>;
export type WifiSpeedProfile = z.infer<typeof wifiSpeedProfileSchema>;
export type WifiRoleSpeedProfile = z.infer<typeof wifiRoleSpeedProfileSchema>;

export const wifiAuthLogSchema = z.object({
  deviceNickname: z.string().nullable().optional(),
  deviceReportedHostname: z.string().nullable().optional(),
  failureReason: z.string().nullable(),
  id: z.number(),
  macAddress: z.string(),
  nasComment: z.string().nullable().optional(),
  nasIpAddress: z.string().nullable(),
  nasMacAddress: z.string().nullable(),
  result: z.boolean(),
  timestamp: z.iso.datetime(),
  userComment: z.string().nullable().optional(),
  username: z.string(),
  wifiUserId: z.uuid().nullable(),
});

export const wifiAuthLogListQuerySchema = wifiListQuerySchema.extend({
  failureReason: z.string().optional(),
  result: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type WifiAuthLogListQuery = z.infer<typeof wifiAuthLogListQuerySchema>;
export type WifiAuthLog = z.infer<typeof wifiAuthLogSchema>;
