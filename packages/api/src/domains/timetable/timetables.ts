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

/** Response for timetable deletion confirmation. */
export const deleteTimetableResponseSchema = z.object({
  success: z.literal(true),
});

/** Response previewing the effects of deleting a timetable. */
export const previewDeleteResponseSchema = z.object({
  data: z.object({
    cohorts: z.array(
      z.object({
        becomesOrphaned: z.boolean(),
        id: z.string(),
        name: z.string(),
      })
    ),
    isCurrentTimetable: z.boolean(),
    targetTimetable: z
      .object({
        id: z.string(),
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
  }),
  success: z.literal(true),
});

/** Response for cleaning up cohorts orphaned by a timetable deletion. */
export const cleanupOrphanedCohortsResponseSchema = z.object({
  data: z.object({
    affectedUserCount: z.number(),
    deletedCohortIds: z.array(z.string()),
  }),
  success: z.literal(true),
});
