import z from 'zod';

const baseBuildingPayloadSchema = z.object({
  description: z.string().min(1).max(16_000),
  name: z.string().min(1).max(190),
  x: z.number().int().min(-32_768).max(32_767),
  y: z.number().int().min(-32_768).max(32_767),
});

/** Payload for creating a navigator building. */
export const createBuildingSchema = baseBuildingPayloadSchema;

/** Payload for updating a navigator building. */
export const updateBuildingSchema = baseBuildingPayloadSchema.partial();

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
