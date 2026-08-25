import z from 'zod';

export const getCohortsForTimetableParamsSchema = z.object({
  timetableId: z.uuid(),
});

export type GetCohortsForTimetableParamsInput = z.infer<
  typeof getCohortsForTimetableParamsSchema
>;
