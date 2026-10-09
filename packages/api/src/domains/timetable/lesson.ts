import z from 'zod';

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
  selectedLessonIds: z.array(z.string().min(1)).default([]),
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
    id: z.string(),
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
  id: z.string(),
  name: z.string(),
  short: z.string(),
  updatedAt: z.date(),
});

/** The period an enriched lesson is scheduled in. */
export const periodRefSchema = z.object({
  endTime: z.string(),
  id: z.string(),
  period: z.number(),
  startTime: z.string(),
});

/** The week definition an enriched lesson belongs to. */
export const weekDefinitionRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  weeks: z.string().array(),
});

export const classroomRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
});

export const cohortRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
});

export const subjectRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
});

export const teacherRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
});

export const groupRefSchema = z.object({
  divisionTag: z.string().nullable(),
  entireClass: z.boolean(),
  id: z.string(),
  name: z.string(),
});

/** Enriched lesson payload of the `timetable.lessons.*` lookups. */
export const enrichedLessonSchema = z.object({
  classrooms: classroomRefSchema.array(),
  cohorts: cohortRefSchema.array(),
  day: dayDefinitionRowSchema.optional(),
  groups: groupRefSchema.array(),
  groupsIds: z.string().array(),
  id: z.string(),
  period: periodRefSchema.nullable(),
  periodsPerWeek: z.number(),
  subject: subjectRefSchema.nullable(),
  teachers: teacherRefSchema.array(),
  termDefinitionId: z.string().nullable(),
  weekDefinition: weekDefinitionRefSchema.nullable(),
  weeksDefinitionId: z.string(),
});

/** Single lesson lookup: the enriched lesson plus the substituted cohort name. */
export const lessonDetailSchema = enrichedLessonSchema.extend({
  substitutionCohortName: z.string().nullable(),
});

export const teacherLessonsBatchResultSchema = z.object({
  lessons: enrichedLessonSchema.array(),
  teacherId: z.uuid(),
});

export const substitutionCandidatesResultSchema = z.object({
  availableLessons: enrichedLessonSchema.array(),
  parallelLessons: enrichedLessonSchema.array(),
  substituteCandidates: substitutionCandidateSchema.array(),
});

/**
 * Lesson as linked from a substitution or a moved lesson: the same enrichment
 * with `cohorts` reduced to names and without group data, matching what
 * `#utils/timetable/enrich-lessons` returns.
 */
export const linkedLessonSchema = z.object({
  classrooms: classroomRefSchema.array(),
  cohorts: z.string().array(),
  day: dayDefinitionRowSchema.optional(),
  id: z.string(),
  period: periodRefSchema.nullable(),
  periodsPerWeek: z.number(),
  subject: subjectRefSchema.nullable(),
  teachers: teacherRefSchema.array(),
  termDefinitionId: z.string().nullable(),
  weeksDefinitionId: z.string(),
});
