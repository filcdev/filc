import z from 'zod';

/** A cohort row, as stored in the `cohort` table. */
export const cohortSelectSchema = z.object({
  classroomIds: z.array(z.string()).nullable(),
  id: z.uuid(),
  name: z.string(),
  short: z.string(),
  teacherId: z.uuid().nullable(),
  timetableId: z.uuid().nullable(),
});

export type CohortSelect = z.infer<typeof cohortSelectSchema>;
