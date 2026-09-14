import z from 'zod';

/** A lift shaft connecting `min_storey`..`max_storey` in one building. */
export const liftSchema = z.object({
  building_id: z.string().min(1),
  id: z.string(),
  max_storey: z.number().int(),
  min_storey: z.number().int(),
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

export const createLiftSchema = liftSchema.omit({ id: true });

export const updateLiftSchema = createLiftSchema.partial();

export type Lift = z.infer<typeof liftSchema>;
export type CreateLiftInput = z.infer<typeof createLiftSchema>;
export type UpdateLiftInput = z.infer<typeof updateLiftSchema>;
