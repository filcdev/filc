import z from 'zod';

const baseStairPayloadSchema = z.object({
  buildingId: z.uuid(),
  maxStorey: z.number().int().min(-32_768).max(32_767),
  minStorey: z.number().int().min(-32_768).max(32_767),
  name: z.string().min(1).max(190),
  rotation: z.number().int().min(0).max(360),
  x: z.number().int().min(-32_768).max(32_767),
  y: z.number().int().min(-32_768).max(32_767),
});

/** Payload for creating a navigator stair. */
export const createStairSchema = baseStairPayloadSchema.refine(
  (data) => data.minStorey <= data.maxStorey,
  {
    message: 'minStorey must be less than or equal to maxStorey',
    path: ['minStorey'],
  }
);

/** Payload for updating a navigator stair. */
export const updateStairSchema = baseStairPayloadSchema
  .partial()
  .refine(
    (data) =>
      data.minStorey === undefined ||
      data.maxStorey === undefined ||
      data.minStorey <= data.maxStorey,
    {
      message: 'minStorey must be less than or equal to maxStorey',
      path: ['minStorey'],
    }
  );

export type CreateStairInput = z.infer<typeof createStairSchema>;
export type UpdateStairInput = z.infer<typeof updateStairSchema>;
