import z from 'zod';

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
  dayDefinitionId: z.string().uuid(),
  periodId: z.string().uuid(),
  subjectId: z.string().uuid(),
  substituter: z.string().uuid().nullable(),
  teacherId: z.string().uuid(),
});

export type ManualCreateInput = z.infer<typeof manualCreateSchema>;
