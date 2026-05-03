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
  name: z.string().min(1, 'Name is required'),
  validFrom: z.date({ error: 'Start date is required' }),
  validTo: z.date().optional(),
});

export const nicknameSchema = z.object({
  nickname: z.string().min(NICKNAME_MIN_LENGTH).max(NICKNAME_MAX_LENGTH),
});
