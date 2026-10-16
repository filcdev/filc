import z from 'zod';

/**
 * A lift row as the API returns it: the columns, unconstrained beyond their
 * types (see `buildingRowSchema` for why). The base definition; the write shape
 * narrows it.
 */
export const liftRowSchema = z.object({
  building_id: z.string(),
  createdAt: z.date(),
  id: z.string(),
  max_storey: z.number().int(),
  min_storey: z.number().int(),
  name: z.string(),
  updatedAt: z.date(),
  x: z.number(),
  y: z.number(),
});

export type LiftRow = z.infer<typeof liftRowSchema>;

/** A lift in a building. */
export const liftSchema = liftRowSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({
    building_id: z.string().min(1),
    name: z.string().min(1),
  });

export const createLiftSchema = liftSchema.omit({ id: true });

export const updateLiftSchema = createLiftSchema.partial();

export type Lift = z.infer<typeof liftSchema>;
export type CreateLiftInput = z.infer<typeof createLiftSchema>;
export type UpdateLiftInput = z.infer<typeof updateLiftSchema>;
