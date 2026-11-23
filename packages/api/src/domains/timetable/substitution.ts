import z from 'zod';

import { lessonSchema } from './lesson';
import { publicTeacherSchema } from './teacher';

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
  cohortId: z.uuid(),
  comment: z.string().nullable().optional(),
  date: z.coerce.date<Date>(),
  periodId: z.uuid(),
  subjectId: z.uuid().nullable(),
  substituter: z.uuid().nullable(),
  teacherId: z.uuid(),
});

export type ManualCreateInput = z.infer<typeof manualCreateSchema>;

/** `substitution` row. */
export const substitutionRowSchema = z.object({
  comment: z.string().nullable(),
  date: z.date(),
  id: z.uuid(),
  substituter: z.uuid().nullable(),
});

/**
 * Substitution with its linked lessons already enriched.
 *
 * These three responses are unauthenticated, so `teacher` is the public shape:
 * the substituter's name is what the timetable shows, and their email and
 * linked user account are not public data.
 */
export const substitutionWithRelationsSchema = z.object({
  lessons: lessonSchema.array(),
  substitution: substitutionRowSchema,
  teacher: publicTeacherSchema.nullable(),
});

/** Substitution carrying bare linked lesson ids. */
export const substitutionWithLessonIdsSchema = z.object({
  lessons: z.array(z.uuid()),
  substitution: substitutionRowSchema,
  teacher: publicTeacherSchema.nullable(),
});

export const substitutionsByCohortSchema = z.object({
  cohortId: z.uuid(),
  substitutions: substitutionWithLessonIdsSchema.array(),
});

/** Body of `timetable.substitutions.create` (path params excluded). */
export const createSubstitutionSchema = z.object({
  comment: z.string().nullable().optional(),
  date: z.coerce.date<Date>(),
  lessonIds: z.array(z.uuid()).min(1),
  substituter: z.uuid().nullable().optional(),
});

/** Body of `timetable.substitutions.update` (path params excluded). */
export const updateSubstitutionSchema = z.object({
  comment: z.string().nullable().optional(),
  date: z.coerce.date<Date>().optional(),
  lessonIds: z.array(z.uuid()).nullable(),
  substituter: z.uuid().nullable().optional(),
});
