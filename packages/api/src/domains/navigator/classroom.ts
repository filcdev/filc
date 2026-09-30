import z from 'zod';

/**
 * A room on a storey of a building. Sizes and rotation are real numbers: the
 * 3D editor allows free rotation, so rotation is not constrained to quarters.
 */
export const classroomSchema = z.object({
  building_id: z.string().min(1),
  capacity: z.number().int(),
  description: z.string(),
  id: z.string(),
  mapped: z.boolean(),
  name: z.string().min(1),
  rotation: z.number(),
  short: z.string(),
  size_x: z.number(),
  size_y: z.number(),
  size_z: z.number(),
  storey: z.number().int(),
  type_id: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

export const createClassroomSchema = classroomSchema.omit({
  id: true,
  mapped: true,
});

export const updateClassroomSchema = createClassroomSchema.partial();

export type Classroom = z.infer<typeof classroomSchema>;
export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;

/**
 * A classroom row as the API returns it. `capacity` and `type_id` are null for
 * the rooms the timetable imported before anyone placed them on the map.
 */
export const classroomRowSchema = z.object({
  building_id: z.string(),
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

export type ClassroomRow = z.infer<typeof classroomRowSchema>;

/** Payload of `GET /navigator/classrooms`. */
export const classroomsResponseSchema = z.object({
  classrooms: z.array(classroomRowSchema),
});

/** Payload of `POST /navigator/classrooms`, `PUT` and `DELETE /navigator/classrooms/{id}`. */
export const classroomResponseSchema = z.object({
  classroom: classroomRowSchema,
});
