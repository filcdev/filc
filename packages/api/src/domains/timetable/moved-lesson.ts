import z from 'zod';

import { classroomRowSchema } from '../navigator/classroom';
import {
  dayDefinitionRowSchema,
  entityRefSchema,
  lessonSchema,
} from './lesson';
import { subjectSelectSchema } from './subject';

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
 * A dedup-checked uuid list: the shared refine behind every id-list field in
 * these shapes. Duplicates in `lessonIds` would hit the MTM primary key and
 * surface as a 500; duplicates in a manual id array would silently store the
 * same id twice. Both are rejected as the malformed request they are.
 */
const uniqueUuidList = (label: string) =>
  z
    .uuid()
    .array()
    .refine(
      (ids) => new Set(ids).size === ids.length,
      `${label} must be unique`
    );

/**
 * The lesson-id list both write shapes take. `min(1)` is deliberately absent:
 * the create shape enforces "at least one lesson or a manual source" in its
 * superRefine, and the update shape is a partial patch where an absent field
 * means "leave it as it is".
 */
const lessonIdsSchema = uniqueUuidList('Lesson ids');

const manualCohortIdsSchema = uniqueUuidList('Cohort ids');
const manualTeacherIdsSchema = uniqueUuidList('Teacher ids');

/** Payload for updating an existing moved lesson. Every field is optional and an
 * omitted one means "leave as it is" — the handler reads `undefined` that way.
 * `room` is nullable because the column is, and a moved lesson may have no room.
 */
export const updateSchema = z.object({
  comment: z.string().nullable().optional(),
  date: z.coerce.date().optional(),
  lessonIds: lessonIdsSchema.optional(),
  manualCohortIds: manualCohortIdsSchema.optional(),
  manualSourceRoomId: z.uuid().nullable().optional(),
  manualSubjectId: z.uuid().optional(),
  manualTeacherIds: manualTeacherIdsSchema.optional(),
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
  manualCohortIds: z.string().array(),
  manualSourceRoomId: z.uuid().nullable(),
  manualSubjectId: z.uuid().nullable(),
  manualTeacherIds: z.string().array(),
  room: z.string().nullable(),
  startingDay: z.uuid().nullable(),
  startingPeriod: z.uuid().nullable(),
});

/** A moved lesson with its target joins and linked, enriched lessons. */
export const movedLessonWithRelationsSchema = z.object({
  classroom: classroomRowSchema.nullable(),
  dayDefinition: dayDefinitionRowSchema.nullable(),
  lessons: lessonSchema.array(),
  manual: z
    .object({
      cohorts: entityRefSchema.array(),
      sourceRoom: entityRefSchema.nullable(),
      subject: subjectSelectSchema.nullable(),
      teachers: entityRefSchema.array(),
    })
    .nullable(),
  movedLesson: movedLessonRowSchema,
  period: periodRowSchema.nullable(),
});

/** A moved lesson with its target joins and linked or manual source data. */
export type MovedLessonWithRelations = z.infer<
  typeof movedLessonWithRelationsSchema
>;

/**
 * Body of `timetable.movedLessons.create` (path params excluded). A moved
 * lesson has exactly one source: either linked lessons (`lessonIds`) or a
 * manual source (`manualSubjectId` together with at least one `manualCohortIds`).
 */
export const createMovedLessonSchema = z
  .object({
    comment: z.string().nullable().optional(),
    date: z.coerce.date(),
    lessonIds: lessonIdsSchema.optional(),
    manualCohortIds: manualCohortIdsSchema.optional(),
    manualSourceRoomId: z.uuid().optional(),
    manualSubjectId: z.uuid().optional(),
    manualTeacherIds: manualTeacherIdsSchema.optional(),
    room: z.string().nullable().optional(),
    startingDay: z.uuid().nullable().optional(),
    startingPeriod: z.uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasLessons = (value.lessonIds?.length ?? 0) > 0;
    const hasManual =
      value.manualSubjectId !== undefined &&
      (value.manualCohortIds?.length ?? 0) > 0;

    if (hasLessons && hasManual) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either lessonIds or a manual source, not both',
      });
      return;
    }

    if (!(hasLessons || hasManual)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide either at least one lessonId or a manual subject with at least one cohort',
      });
    }
  });
