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
