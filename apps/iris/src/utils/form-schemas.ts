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

export const navigatorBuildingSchema = z.object({
  description: z.string().min(1, 'Description is required').max(16_000),
  name: z.string().min(1, 'Name is required').max(190),
  x: z.coerce.number().int('X must be a whole number').min(-32_768).max(32_767),
  y: z.coerce.number().int('Y must be a whole number').min(-32_768).max(32_767),
});

export const navigatorClassroomTypeSchema = z.object({
  colorhex: z
    .string()
    .regex(/^#[0-9a-fA-F]{8}$/, 'Color must be an #RRGGBBAA hex value')
    .nullable()
    .optional(),
  name: z.string().min(1, 'Name is required').max(100),
});

export const navigatorClassroomSchema = z.object({
  buildingId: z.uuid('A building is required'),
  capacity: z.coerce.number().int('Capacity must be a whole number').min(0),
  description: z.string().min(1, 'Description is required').max(16_000),
  name: z.string().min(1, 'Name is required').max(254),
  rotation: z.coerce
    .number()
    .int('Rotation must be a whole number')
    .min(0)
    .max(360),
  sizeX: z.coerce.number().int('Size X must be a whole number').min(0),
  sizeY: z.coerce.number().int('Size Y must be a whole number').min(0),
  sizeZ: z.coerce.number().int('Size Z must be a whole number').min(0),
  storey: z.coerce
    .number()
    .int('Storey must be a whole number')
    .min(-128)
    .max(127),
  typeId: z.uuid('A classroom type is required'),
  x: z.coerce.number().int('X must be a whole number').min(-32_768).max(32_767),
  y: z.coerce.number().int('Y must be a whole number').min(-32_768).max(32_767),
});

export const navigatorCorridorSchema = z.object({
  barrierFree: z.boolean(),
  buildingId: z.uuid('A building is required'),
  isOutdoor: z.boolean(),
  name: z.string().min(1, 'Name is required').max(254),
  storey: z.coerce
    .number()
    .int('Storey must be a whole number')
    .min(-32_768)
    .max(32_767),
  width: z.coerce.number().min(0.5, 'Width must be at least 0.5').max(20),
  x1: z.coerce
    .number()
    .int('X1 must be a whole number')
    .min(-32_768)
    .max(32_767),
  x2: z.coerce
    .number()
    .int('X2 must be a whole number')
    .min(-32_768)
    .max(32_767),
  y1: z.coerce
    .number()
    .int('Y1 must be a whole number')
    .min(-32_768)
    .max(32_767),
  y2: z.coerce
    .number()
    .int('Y2 must be a whole number')
    .min(-32_768)
    .max(32_767),
});

export const navigatorLiftSchema = z.object({
  buildingId: z.uuid('A building is required'),
  maxStorey: z.coerce
    .number()
    .int('Max storey must be a whole number')
    .min(-32_768)
    .max(32_767),
  minStorey: z.coerce
    .number()
    .int('Min storey must be a whole number')
    .min(-32_768)
    .max(32_767),
  name: z.string().min(1, 'Name is required').max(190),
  x: z.coerce.number().int('X must be a whole number').min(-32_768).max(32_767),
  y: z.coerce.number().int('Y must be a whole number').min(-32_768).max(32_767),
});

export const navigatorStairSchema = z.object({
  buildingId: z.uuid('A building is required'),
  maxStorey: z.coerce
    .number()
    .int('Max storey must be a whole number')
    .min(-32_768)
    .max(32_767),
  minStorey: z.coerce
    .number()
    .int('Min storey must be a whole number')
    .min(-32_768)
    .max(32_767),
  name: z.string().min(1, 'Name is required').max(190),
  rotation: z.coerce
    .number()
    .int('Rotation must be a whole number')
    .min(0)
    .max(360),
  x: z.coerce.number().int('X must be a whole number').min(-32_768).max(32_767),
  y: z.coerce.number().int('Y must be a whole number').min(-32_768).max(32_767),
});

export const navigatorTranslationSchema = z.object({
  langKey: z.string().min(1, 'Language is required').max(10),
  text: z.string().min(1, 'Text is required').max(16_000),
  textKey: z.string().min(1, 'Key is required').max(190),
});
