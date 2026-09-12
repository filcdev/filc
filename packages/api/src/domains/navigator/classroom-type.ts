import z from 'zod';

const baseClassroomTypePayloadSchema = z.object({
  colorhex: z
    .string()
    .regex(/^#([0-9a-fA-F]{8})$/)
    .nullable()
    .optional(),
  name: z.string().min(1).max(100),
});

/** Payload for creating a navigator classroom type. */
export const createClassroomTypeSchema = baseClassroomTypePayloadSchema;

/** Payload for updating a navigator classroom type. */
export const updateClassroomTypeSchema =
  baseClassroomTypePayloadSchema.partial();

export type CreateClassroomTypeInput = z.infer<
  typeof createClassroomTypeSchema
>;
export type UpdateClassroomTypeInput = z.infer<
  typeof updateClassroomTypeSchema
>;
