import z from 'zod';

/**
 * A `classroom` row as the timetable serves it. `building_id`, `capacity` and
 * `type_id` are nullable because the timetable import creates rooms before
 * anyone has placed or categorised them; the snake_case names are the shared
 * wire shape with the Navigator columns.
 */
export const classroomSelectSchema = z.object({
  building_id: z.string().nullable(),
  capacity: z.number().int().nullable(),
  description: z.string(),
  id: z.string(),
  mapped: z.boolean(),
  name: z.string(),
  rotation: z.number(),
  short: z.string(),
  size_x: z.number(),
  size_y: z.number(),
  size_z: z.number(),
  storey: z.number().int(),
  type_id: z.string().nullable(),
  x: z.number(),
  y: z.number(),
});

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
