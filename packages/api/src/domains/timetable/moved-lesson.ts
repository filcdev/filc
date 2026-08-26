import z from 'zod';

/** Path parameters for moved lesson endpoints addressed by moved lesson id. */
export const movedLessonIdParamsSchema = z.object({
  id: z.uuid(),
});

export type MovedLessonIdParamsInput = z.infer<
  typeof movedLessonIdParamsSchema
>;

/** Path parameters for moved lesson endpoints scoped to a timetable. */
export const timetableIdParamsSchema = z.object({
  timetableId: z.uuid(),
});

export type TimetableIdParamsInput = z.infer<typeof timetableIdParamsSchema>;

/** Path parameters for moved lesson endpoints scoped to a cohort. */
export const cohortIdParamsSchema = z.object({
  cohortId: z.uuid(),
});

export type CohortIdParamsInput = z.infer<typeof cohortIdParamsSchema>;

/** Payload for updating an existing moved lesson. */
export const updateSchema = z.object({
  date: z.coerce.date(),
  lessonIds: z.uuid().array(),
  room: z.string(),
  startingDay: z.uuid(),
  startingPeriod: z.uuid(),
});

export type UpdateMovedLessonInput = z.infer<typeof updateSchema>;
