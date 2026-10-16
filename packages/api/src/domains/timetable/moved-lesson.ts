import z from 'zod';

import { classroomRowSchema } from '../navigator/classroom';
import { dayDefinitionRowSchema, lessonSchema } from './lesson';

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

/**
 * The lesson-id list both write shapes take. Duplicates would hit the MTM
 * primary key and surface as a 500, so they are rejected as the malformed
 * request they are.
 */
const lessonIdsSchema = z
  .uuid()
  .array()
  .min(1)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    'Lesson ids must be unique'
  );

/** Payload for updating an existing moved lesson. Every field is optional and an
 * omitted one means "leave as it is" — the handler reads `undefined` that way.
 * `room` is nullable because the column is, and a moved lesson may have no room.
 */
export const updateSchema = z.object({
  comment: z.string().nullable().optional(),
  date: z.coerce.date().optional(),
  lessonIds: lessonIdsSchema.optional(),
  room: z.string().nullable().optional(),
  startingDay: z.uuid().optional(),
  startingPeriod: z.uuid().optional(),
});

export type UpdateMovedLessonInput = z.infer<typeof updateSchema>;

/** `period` row, as returned alongside a moved lesson. */
export const periodRowSchema = z.object({
  createdAt: z.date(),
  endTime: z.string(),
  id: z.uuid(),
  period: z.number().int(),
  startTime: z.string(),
  updatedAt: z.date(),
});

/** `moved_lesson` row. */
export const movedLessonRowSchema = z.object({
  comment: z.string().nullable(),
  date: z.date(),
  id: z.uuid(),
  room: z.string().nullable(),
  startingDay: z.uuid().nullable(),
  startingPeriod: z.uuid().nullable(),
});

/** A moved lesson with its target joins and linked, enriched lessons. */
export const movedLessonWithRelationsSchema = z.object({
  classroom: classroomRowSchema.nullable(),
  dayDefinition: dayDefinitionRowSchema.nullable(),
  lessons: lessonSchema.array(),
  movedLesson: movedLessonRowSchema,
  period: periodRowSchema.nullable(),
});

/** Body of `timetable.movedLessons.create` (path params excluded). */
export const createMovedLessonSchema = z.object({
  comment: z.string().nullable().optional(),
  date: z.coerce.date(),
  lessonIds: lessonIdsSchema,
  room: z.string().nullable().optional(),
  startingDay: z.uuid().nullable().optional(),
  startingPeriod: z.uuid().nullable().optional(),
});
