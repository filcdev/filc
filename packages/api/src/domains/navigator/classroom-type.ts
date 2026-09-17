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
