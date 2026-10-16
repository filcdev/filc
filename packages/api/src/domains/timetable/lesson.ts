import z from 'zod';

import { periodSelectSchema } from './period';

export const getLessonsForCohortParamsSchema = z.object({
  cohortId: z.uuid(),
});

export type GetLessonsForCohortParamsInput = z.infer<
  typeof getLessonsForCohortParamsSchema
>;

export const getLessonsQuerySchema = z.object({
  timetableId: z.uuid().optional(),
});

export type GetLessonsQueryInput = z.infer<typeof getLessonsQuerySchema>;

export const getLessonsForTeacherParamsSchema = z.object({
  teacherId: z.uuid(),
});

export type GetLessonsForTeacherParamsInput = z.infer<
  typeof getLessonsForTeacherParamsSchema
>;

export const getLessonsForRoomParamsSchema = z.object({
  classroomId: z.uuid(),
});

export type GetLessonsForRoomParamsInput = z.infer<
  typeof getLessonsForRoomParamsSchema
>;

export const getLessonForIdParamsSchema = z.object({
  lessonId: z.uuid(),
});

export type GetLessonForIdParamsInput = z.infer<
  typeof getLessonForIdParamsSchema
>;

export const teacherLessonsBatchRequestSchema = z.object({
  teacherIds: z.array(z.uuid()).min(1),
});

export type TeacherLessonsBatchRequestInput = z.infer<
  typeof teacherLessonsBatchRequestSchema
>;

export const substitutionCandidatesRequestSchema = z.object({
  date: z.coerce.date(),
  missingTeacherId: z.uuid(),
  selectedLessonIds: z.array(z.uuid()).default([]),
  teacherIds: z.array(z.uuid()).min(1),
});

export type SubstitutionCandidatesRequestInput = z.infer<
  typeof substitutionCandidatesRequestSchema
>;

export const substitutionCandidateSchema = z.object({
  hasH1: z.boolean(),
  hasH2: z.boolean(),
  teacher: z.object({
    firstName: z.string(),
    id: z.uuid(),
    lastName: z.string(),
    short: z.string(),
  }),
});

export type SubstitutionCandidateInput = z.infer<
  typeof substitutionCandidateSchema
>;

/** `day_definition` row, as it is nested into an enriched lesson. */
export const dayDefinitionRowSchema = z.object({
  createdAt: z.date(),
  days: z.string().array().nullable(),
  id: z.uuid(),
  name: z.string(),
  short: z.string(),
  updatedAt: z.date(),
});

/** The week definition an enriched lesson belongs to. */
export const weekDefinitionRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  short: z.string(),
  weeks: z.string().array(),
});

/**
 * A lightweight reference to a named entity that carries a short code — used
 * for the classroom/cohort/subject/teacher projections on a linked lesson.
 *
 * One schema rather than four identical ones: they are the same projection of
 * different tables, the field name at the use site is what says which, and four
 * copies would let a change to one silently diverge from the rest.
 */
export const entityRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
});

export const groupRefSchema = z.object({
  divisionTag: z.string().nullable(),
  entireClass: z.boolean(),
  id: z.uuid(),
  name: z.string(),
});

/** A lesson as returned by the `timetable.lessons.*` lookups and embedded into substitutions and moved lessons. */
export const lessonSchema = z.object({
  classrooms: entityRefSchema.array(),
  cohorts: entityRefSchema.array(),
  day: dayDefinitionRowSchema.optional(),
  groups: groupRefSchema.array(),
  groupsIds: z.array(z.uuid()),
  id: z.uuid(),
  period: periodSelectSchema.nullable(),
  periodsPerWeek: z.number(),
  subject: entityRefSchema.nullable(),
  teachers: entityRefSchema.array(),
  termDefinitionId: z.uuid().nullable(),
  weekDefinition: weekDefinitionRefSchema.nullable(),
  weeksDefinitionId: z.uuid(),
});

export type Lesson = z.infer<typeof lessonSchema>;

/** Single lesson lookup: the lesson plus the substituted cohort name. */
export const lessonDetailSchema = lessonSchema.extend({
  substitutionCohortName: z.string().nullable(),
});

export const teacherLessonsBatchResultSchema = z.object({
  lessons: lessonSchema.array(),
  teacherId: z.uuid(),
});

export const substitutionCandidatesResultSchema = z.object({
  availableLessons: lessonSchema.array(),
  parallelLessons: lessonSchema.array(),
  substituteCandidates: substitutionCandidateSchema.array(),
});
