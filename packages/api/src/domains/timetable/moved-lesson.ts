import z from 'zod';

/** Path parameters for moved lesson endpoints addressed by moved lesson id. */
export const movedLessonIdParamsSchema = z.object({
  id: z.uuid(),
});

export type MovedLessonIdParamsInput = z.infer<
  typeof movedLessonIdParamsSchema
>;

/** Path parameters for moved lesson endpoints scoped to a cohort. */
export const cohortIdParamsSchema = z.object({
  cohortId: z.uuid(),
});

export type CohortIdParamsInput = z.infer<typeof cohortIdParamsSchema>;

/** Payload for updating an existing moved lesson. */
export const updateSchema = z.object({
  comment: z.string().nullable().optional(),
  date: z.coerce.date(),
  lessonIds: z.uuid().array().min(1),
  room: z.string(),
  startingDay: z.uuid(),
  startingPeriod: z.uuid(),
});

export type UpdateMovedLessonInput = z.infer<typeof updateSchema>;

/**
 * Payload for creating a moved lesson manually, without knowing the source
 * lesson id. The backend finds (or creates) the source lesson from the source
 * date/period/cohort/room and links it to the new moved lesson.
 */
export const manualCreateSchema = z.object({
  cohortId: z.uuid(),
  comment: z.string().nullable().optional(),
  sourceDate: z.coerce.date<Date>(),
  sourcePeriodId: z.uuid(),
  sourceRoomId: z.uuid(),
  targetDate: z.coerce.date<Date>(),
  targetPeriodId: z.uuid(),
  targetRoomId: z.uuid(),
});

export type ManualCreateMovedLessonInput = z.infer<typeof manualCreateSchema>;
