import z from 'zod';

const baseClassroomPayloadSchema = z.object({
  buildingId: z.uuid(),
  capacity: z.number().int().min(0).max(32_767),
  description: z.string().min(1).max(16_000),
  name: z.string().min(1).max(254),
  rotation: z.number().int().min(0).max(360),
  sizeX: z.number().int().min(0).max(32_767),
  sizeY: z.number().int().min(0).max(32_767),
  sizeZ: z.number().int().min(0).max(32_767),
  storey: z.number().int().min(-128).max(127),
  typeId: z.uuid(),
  x: z.number().int().min(-32_768).max(32_767),
  y: z.number().int().min(-32_768).max(32_767),
});

/** Payload for creating a navigator classroom. */
export const createClassroomSchema = baseClassroomPayloadSchema;

/** Payload for updating a navigator classroom. */
export const updateClassroomSchema = baseClassroomPayloadSchema.partial();

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;
