import z from 'zod';

import { linkedLessonSchema } from './lesson';

/** Path parameters for substitution endpoints addressed by substitution id. */
export const substitutionIdParamsSchema = z.object({
  id: z.uuid(),
});

export type SubstitutionIdParamsInput = z.infer<
  typeof substitutionIdParamsSchema
>;

/** Path parameters for substitution endpoints scoped to a cohort. */
export const cohortIdParamsSchema = z.object({
  cohortId: z.uuid(),
});

export type CohortIdParamsInput = z.infer<typeof cohortIdParamsSchema>;

/**
 * Payload for creating a substitution by linking existing lesson ids.
 *
 * Note: the enriched response schemas for substitution endpoints mix
 * drizzle-derived schemas (`createSelectSchema`) with hand-written fields and
 * therefore remain in apps/chronos.
 */
export const manualCreateSchema = z.object({
  cohortId: z.string().uuid(),
  comment: z.string().nullable().optional(),
  date: z.coerce.date<Date>(),
  periodId: z.string().uuid(),
  subjectId: z.string().uuid().nullable(),
  substituter: z.string().uuid().nullable(),
  teacherId: z.string().uuid(),
});

export type ManualCreateInput = z.infer<typeof manualCreateSchema>;

/** `teacher` row. */
export const teacherRowSchema = z.object({
  email: z.string().nullable(),
  firstName: z.string(),
  gender: z
    .string()
    .max(1)
    .regex(/^[01]+$/)
    .nullable(),
  id: z.string(),
  lastName: z.string(),
  short: z.string(),
  userId: z.uuid().nullable(),
});

/** `substitution` row. */
export const substitutionRowSchema = z.object({
  comment: z.string().nullable(),
  date: z.date(),
  id: z.string(),
  substituter: z.string().nullable(),
});

/** Substitution with its linked lessons already enriched. */
export const substitutionWithRelationsSchema = z.object({
  lessons: linkedLessonSchema.array(),
  substitution: substitutionRowSchema,
  teacher: teacherRowSchema.nullable(),
});

/** Substitution carrying bare linked lesson ids. */
export const substitutionWithLessonIdsSchema = z.object({
  lessons: z.string().array(),
  substitution: substitutionRowSchema,
  teacher: teacherRowSchema.nullable(),
});

export const substitutionsByCohortSchema = z.object({
  cohortId: z.string(),
  substitutions: substitutionWithLessonIdsSchema.array(),
});

/** Body of `timetable.substitutions.create` (path params excluded). */
export const createSubstitutionSchema = z.object({
  comment: z.string().nullable().optional(),
  date: z.coerce.date<Date>(),
  lessonIds: z.string().array().min(1),
  substituter: z.string().nullable().optional(),
});

/** Body of `timetable.substitutions.update` (path params excluded). */
export const updateSubstitutionSchema = z.object({
  comment: z.string().nullable().optional(),
  date: z.coerce.date<Date>().optional(),
  lessonIds: z.string().array().nullable(),
  substituter: z.string().nullable().optional(),
});
