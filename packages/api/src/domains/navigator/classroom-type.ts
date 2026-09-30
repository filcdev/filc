import z from 'zod';

/** A classroom category; `colorhex` is the fill colour used in the 3D views. */
export const classroomTypeSchema = z.object({
  colorhex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a hex value like #1a2b3c'),
  id: z.string(),
  name: z.string().min(1),
});

export const createClassroomTypeSchema = classroomTypeSchema.omit({ id: true });

export const updateClassroomTypeSchema = createClassroomTypeSchema.partial();

export type ClassroomType = z.infer<typeof classroomTypeSchema>;
export type CreateClassroomTypeInput = z.infer<
  typeof createClassroomTypeSchema
>;
export type UpdateClassroomTypeInput = z.infer<
  typeof updateClassroomTypeSchema
>;

/** A classroom-type row as the API returns it (see `buildingRowSchema`). */
export const classroomTypeRowSchema = z.object({
  colorhex: z.string(),
  createdAt: z.date(),
  id: z.string(),
  name: z.string(),
  updatedAt: z.date(),
});

export type ClassroomTypeRow = z.infer<typeof classroomTypeRowSchema>;

/** Payload of `GET /navigator/classroom-types`. */
export const classroomTypesResponseSchema = z.object({
  classroom_types: z.array(classroomTypeRowSchema),
});

/** Payload of the `POST`/`PUT`/`DELETE` classroom-type procedures. */
export const classroomTypeResponseSchema = z.object({
  classroom_type: classroomTypeRowSchema,
});
