import z from 'zod';

const baseCorridorPayloadSchema = z.object({
  barrierFree: z.boolean(),
  buildingId: z.uuid(),
  isOutdoor: z.boolean(),
  name: z.string().min(1).max(254),
  storey: z.number().int().min(-32_768).max(32_767),
  width: z.number().min(0.5).max(20),
  x1: z.number().int().min(-32_768).max(32_767),
  x2: z.number().int().min(-32_768).max(32_767),
  y1: z.number().int().min(-32_768).max(32_767),
  y2: z.number().int().min(-32_768).max(32_767),
});

/** Payload for creating a navigator corridor. */
export const createCorridorSchema = baseCorridorPayloadSchema.extend({
  barrierFree: z.boolean().default(false),
  isOutdoor: z.boolean().default(false),
});

/** Payload for updating a navigator corridor. */
export const updateCorridorSchema = baseCorridorPayloadSchema.partial();

export type CreateCorridorInput = z.infer<typeof createCorridorSchema>;
export type UpdateCorridorInput = z.infer<typeof updateCorridorSchema>;
