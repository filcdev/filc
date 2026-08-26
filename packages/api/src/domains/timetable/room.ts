import z from 'zod';

/** Query for available classrooms at a given date and period. */
export const getAvailableClassroomsQuerySchema = z.object({
  date: z.coerce.date(),
  startingDay: z.string().uuid(),
  startingPeriod: z.string().uuid(),
  timetableId: z.string().uuid().optional(),
});

export type GetAvailableClassroomsQueryInput = z.infer<
  typeof getAvailableClassroomsQuerySchema
>;
