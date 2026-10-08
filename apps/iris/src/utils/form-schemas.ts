import { z } from 'zod';

export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 32;
export const nicknamePattern = /^[\p{L}\p{N} _'-]+$/u;

export const cardBaseSchema = z.object({
  authorizedDeviceIds: z.array(z.string()),
  cardData: z.string(),
  enabled: z.boolean(),
  frozen: z.boolean(),
  name: z.string().min(1, 'Name is required'),
  userId: z.string().nullable(),
});

export const createCardSchema = cardBaseSchema.refine(
  (d) => d.cardData.trim().length > 0,
  { message: 'Card UID is required', path: ['cardData'] }
);

export const updateCardSchema = cardBaseSchema;

export const deviceSchema = z.object({
  apiToken: z.string().min(1, 'API token is required'),
  lastResetReason: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  name: z.string().min(1, 'Name is required'),
});

export const userFormSchema = z.object({
  nickname: z.string(),
  roles: z.array(z.string()),
});

export const roleSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, 'Only lowercase letters, numbers, _ and - allowed'),
  permissions: z.array(z.string()),
});

export const newsItemSchema = z.object({
  cohortIds: z.array(z.string()),
  content: z.array(z.object({ content: z.string(), type: z.string() })),
  title: z.string().min(1, 'Title is required'),
  validFrom: z.date(),
  validUntil: z.date(),
});

export const substitutionSchema = z.object({
  comment: z.string().nullable().optional(),
  date: z.date(),
  lessonIds: z.array(z.string()).min(1, 'Select at least one lesson'),
  substituter: z.string().nullable(),
});

export const movedLessonSchema = z.object({
  date: z.date(),
  lessonIds: z.array(z.string()).min(1, 'Select at least one lesson'),
  room: z.string().optional(),
  startingDay: z.string().optional(),
  startingPeriod: z.string().optional(),
});

export const timetableImportSchema = z.object({
  file: z.instanceof(File),
  name: z.string().min(1, 'Name is required'),
  validFrom: z.date({ error: 'Start date is required' }),
  validTo: z.date().optional(),
});

export const nicknameSchema = z.object({
  nickname: z.string().min(NICKNAME_MIN_LENGTH).max(NICKNAME_MAX_LENGTH),
});

export const otaUpdateSchema = z.object({
  url: z.string().trim().min(1, 'Firmware URL is required'),
});

/** better-auth's api-key plugin rejects names outside 1-32 characters. */
export const API_KEY_NAME_MAX_LENGTH = 32;

export const apiKeyNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(API_KEY_NAME_MAX_LENGTH, 'Name is too long');

/** Creating a key needs a name and one of the expiry choices. */
export const createApiKeySchema = z.object({
  expiresIn: z.string(),
  name: apiKeyNameSchema,
});

/** Renaming only touches the name. */
export const renameApiKeySchema = z.object({
  name: apiKeyNameSchema,
});

export const timetableEditSchema = z.object({
  name: z.string(),
  validFrom: z.date().optional(),
  validTo: z.date().optional(),
});

/**
 * WiFi admin forms. These mirror the wire schemas in
 * `@filcdev/api/domains/wifi/admin` without their transforms and defaults:
 * TanStack Form's `validators` take a schema whose *input* type equals the
 * form values, and a `z.default()`/`z.transform()` makes the input optional.
 * The wire schema is still what the mutation sends — only validation runs here.
 */
// Mirrors the wire schema: the stored form is canonical (12 hex digits, no
// separators) and an operator may type either form.
const wifiMacSchema = z
  .string()
  .regex(
    /^(?:[0-9a-fA-F]{12}|(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2})$/,
    'Invalid MAC address'
  );

export const WIFI_PASSWORD_MIN_LENGTH = 8;

/**
 * The user dialog's validator. A single factory (rather than a create/update
 * pair) because TanStack Form's `validators` option takes one schema per hook:
 * a ternary between two schema types is not assignable.
 */
export const wifiUserFormValidator = (isEditing: boolean) =>
  z
    .object({
      allowedMacAddresses: z.array(wifiMacSchema).optional(),
      banned: z.boolean(),
      comment: z.string(),
      password: z.string().max(256),
      speedProfileId: z.string().nullable(),
      username: z.string().min(1),
    })
    .refine(
      (value) =>
        value.password === '' ? isEditing : value.password.length >= 8,
      {
        message: `Password must be at least ${WIFI_PASSWORD_MIN_LENGTH} characters`,
        path: ['password'],
      }
    );

export const wifiDeviceFormSchema = z.object({
  adminNotes: z.string(),
  banned: z.boolean(),
  macAddress: wifiMacSchema,
  nickname: z.string(),
  wifiUserId: z.string().nullable(),
});

export const wifiNasFormSchema = z.object({
  comment: z.string(),
  ipAddress: z.string().min(1),
  macAddress: wifiMacSchema,
});

export const wifiSpeedProfileFormSchema = z.object({
  downloadSpeedMbps: z.number().int().min(-1),
  name: z.string().min(1),
  uploadSpeedMbps: z.number().int().min(-1),
});

export const wifiRoleProfileFormSchema = z.object({
  priority: z.number().int(),
  roleName: z.string().min(1),
  speedProfileId: z.string().min(1),
});
