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

/**
 * Rejects blank numeric input before `z.coerce.number()` runs, so a cleared
 * field fails validation instead of silently coercing `''` into `0`.
 */
const requiredNumber = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    schema
  );

export const navigatorBuildingSchema = z.object({
  description: z.string().min(1, 'Description is required').max(16_000),
  name: z.string().min(1, 'Name is required').max(190),
  x: requiredNumber(
    z.coerce
      .number('X is required')
      .int('X must be a whole number')
      .min(-32_768)
      .max(32_767)
  ),
  y: requiredNumber(
    z.coerce
      .number('Y is required')
      .int('Y must be a whole number')
      .min(-32_768)
      .max(32_767)
  ),
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
  capacity: requiredNumber(
    z.coerce
      .number('Capacity is required')
      .int('Capacity must be a whole number')
      .min(0)
      .max(32_767)
  ),
  description: z.string().min(1, 'Description is required').max(16_000),
  name: z.string().min(1, 'Name is required').max(254),
  rotation: requiredNumber(
    z.coerce
      .number('Rotation is required')
      .int('Rotation must be a whole number')
      .min(0)
      .max(360)
  ),
  sizeX: requiredNumber(
    z.coerce
      .number('Size X is required')
      .int('Size X must be a whole number')
      .min(0)
      .max(32_767)
  ),
  sizeY: requiredNumber(
    z.coerce
      .number('Size Y is required')
      .int('Size Y must be a whole number')
      .min(0)
      .max(32_767)
  ),
  sizeZ: requiredNumber(
    z.coerce
      .number('Size Z is required')
      .int('Size Z must be a whole number')
      .min(0)
      .max(32_767)
  ),
  storey: requiredNumber(
    z.coerce
      .number('Storey is required')
      .int('Storey must be a whole number')
      .min(-128)
      .max(127)
  ),
  typeId: z.uuid('A classroom type is required'),
  x: requiredNumber(
    z.coerce
      .number('X is required')
      .int('X must be a whole number')
      .min(-32_768)
      .max(32_767)
  ),
  y: requiredNumber(
    z.coerce
      .number('Y is required')
      .int('Y must be a whole number')
      .min(-32_768)
      .max(32_767)
  ),
});

const navigatorInt16 = (label: string) =>
  requiredNumber(
    z.coerce
      .number(`${label} is required`)
      .int(`${label} must be a whole number`)
      .min(-32_768)
      .max(32_767)
  );

const navigatorUtilityCommonFields = {
  buildingId: z.uuid('A building is required'),
};

const navigatorCorridorUtilityFields = {
  ...navigatorUtilityCommonFields,
  name: z.string().min(1, 'Name is required').max(254),
  storey: navigatorInt16('Storey'),
  width: requiredNumber(
    z.coerce
      .number('Width is required')
      .min(0.5, 'Width must be at least 0.5')
      .max(20)
  ),
  x1: navigatorInt16('X1'),
  x2: navigatorInt16('X2'),
  y1: navigatorInt16('Y1'),
  y2: navigatorInt16('Y2'),
};

const navigatorLiftUtilityFields = {
  ...navigatorUtilityCommonFields,
  maxStorey: navigatorInt16('Max storey'),
  minStorey: navigatorInt16('Min storey'),
  name: z.string().min(1, 'Name is required').max(190),
  x: navigatorInt16('X'),
  y: navigatorInt16('Y'),
};

const navigatorStairUtilityFields = {
  ...navigatorLiftUtilityFields,
  rotation: requiredNumber(
    z.coerce
      .number('Rotation is required')
      .int('Rotation must be a whole number')
      .min(0)
      .max(360)
  ),
};

export const navigatorUtilitySchema = z
  .discriminatedUnion('kind', [
    z.object({
      ...navigatorCorridorUtilityFields,
      barrierFree: z.boolean(),
      isOutdoor: z.boolean(),
      kind: z.literal('corridor'),
    }),
    z.object({
      ...navigatorLiftUtilityFields,
      kind: z.literal('lift'),
    }),
    z.object({
      ...navigatorStairUtilityFields,
      kind: z.literal('stair'),
    }),
  ])
  .refine(
    (data) => data.kind === 'corridor' || data.minStorey <= data.maxStorey,
    {
      message: 'Min storey must be less than or equal to max storey',
      path: ['minStorey'],
    }
  );

export const navigatorTranslationSchema = z.object({
  langKey: z.string().min(1, 'Language is required').max(10),
  text: z.string().min(1, 'Text is required').max(16_000),
  textKey: z.string().min(1, 'Key is required').max(190),
});
