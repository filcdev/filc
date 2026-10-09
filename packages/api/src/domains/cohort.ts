import z from 'zod';

/** A cohort row, as stored in the `cohort` table. */
export const cohortSelectSchema = z.object({
  classroomIds: z.array(z.string()).nullable(),
  id: z.string(),
  name: z.string(),
  short: z.string(),
  teacherId: z.string().nullable(),
  timetableId: z.string().nullable(),
});

export type CohortSelect = z.infer<typeof cohortSelectSchema>;
