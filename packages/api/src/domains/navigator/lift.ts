import z from 'zod';

const baseLiftPayloadSchema = z.object({
  buildingId: z.uuid(),
  maxStorey: z.number().int().min(-32_768).max(32_767),
  minStorey: z.number().int().min(-32_768).max(32_767),
  name: z.string().min(1).max(190),
  x: z.number().int().min(-32_768).max(32_767),
  y: z.number().int().min(-32_768).max(32_767),
});

/** Payload for creating a navigator lift. */
export const createLiftSchema = baseLiftPayloadSchema.refine(
  (data) => data.minStorey <= data.maxStorey,
  {
    message: 'minStorey must be less than or equal to maxStorey',
    path: ['minStorey'],
  }
);

/** Payload for updating a navigator lift. */
export const updateLiftSchema = baseLiftPayloadSchema
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

export type CreateLiftInput = z.infer<typeof createLiftSchema>;
export type UpdateLiftInput = z.infer<typeof updateLiftSchema>;
