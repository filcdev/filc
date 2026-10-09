import z from 'zod';

import { dayDefinitionRowSchema, linkedLessonSchema } from './lesson';

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

/** `classroom` row, as returned alongside a moved lesson. */
export const classroomRowSchema = z.object({
  building_id: z.string(),
  capacity: z.number().int().nullable(),
  description: z.string(),
  id: z.string(),
  mapped: z.boolean(),
  name: z.string(),
  rotation: z.number(),
  short: z.string(),
  size_x: z.number(),
  size_y: z.number(),
  size_z: z.number(),
  storey: z.number().int(),
  type_id: z.string().nullable(),
  x: z.number(),
  y: z.number(),
});

/** `period` row, as returned alongside a moved lesson. */
export const periodRowSchema = z.object({
  createdAt: z.date(),
  endTime: z.string(),
  id: z.string(),
  period: z.number().int(),
  startTime: z.string(),
  updatedAt: z.date(),
});

/** `moved_lesson` row. */
export const movedLessonRowSchema = z.object({
  comment: z.string().nullable(),
  date: z.date(),
  id: z.string(),
  room: z.string().nullable(),
  startingDay: z.string().nullable(),
  startingPeriod: z.string().nullable(),
});

/** A moved lesson with its target joins and linked, enriched lessons. */
export const movedLessonWithRelationsSchema = z.object({
  classroom: classroomRowSchema.nullable(),
  dayDefinition: dayDefinitionRowSchema.nullable(),
  lessons: linkedLessonSchema.array(),
  movedLesson: movedLessonRowSchema,
  period: periodRowSchema.nullable(),
});

/** Body of `timetable.movedLessons.create` (path params excluded). */
export const createMovedLessonSchema = z.object({
  comment: z.string().nullable().optional(),
  date: z.coerce.date(),
  lessonIds: z.uuid().array().min(1),
  room: z.string().nullable().optional(),
  startingDay: z.string().nullable().optional(),
  startingPeriod: z.string().nullable().optional(),
});
