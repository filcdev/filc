import z from 'zod';

/** Path parameter for timetable endpoints addressed by id. */
export const timetableIdParamsSchema = z.object({
  id: z.uuid(),
});

export type TimetableIdParamsInput = z.infer<typeof timetableIdParamsSchema>;

/** Payload for updating a timetable's validity window. */
export const updateTimetableSchema = z.object({
  name: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
});

export type UpdateTimetableInput = z.infer<typeof updateTimetableSchema>;

/**
 * A `timetable` row. `validFrom`/`validTo` are `date` columns, so they stay
 * strings; the timestamps are real `Date`s over RPC.
 */
export const timetableSelectSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  name: z.string(),
  updatedAt: z.date(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
});

/** Payload of a timetable deletion; the id is all the caller needs to know. */
export const deleteTimetablePayloadSchema = z.object({
  id: z.uuid(),
});

/** Response previewing the effects of deleting a timetable. */
export const previewDeletePayloadSchema = z.object({
  cohorts: z.array(
    z.object({
      becomesOrphaned: z.boolean(),
      id: z.uuid(),
      name: z.string(),
    })
  ),
  isCurrentTimetable: z.boolean(),
  targetTimetable: z
    .object({
      id: z.uuid(),
      name: z.string(),
    })
    .nullable(),
  totals: z.object({
    danglingUsersCleaned: z.number(),
    lessonsDeleted: z.number(),
    movedLessonsDeleted: z.number(),
    orphanedCohorts: z.number(),
    substitutionsDeleted: z.number(),
    survivingCohorts: z.number(),
  }),
});

/** Response of cleaning up orphaned cohorts and unassigned teachers. */
export const cleanupOrphanedCohortsPayloadSchema = z.object({
  affectedUserCount: z.number(),
  deletedCohortIds: z.array(z.uuid()),
  deletedTeacherIds: z.array(z.uuid()),
});
