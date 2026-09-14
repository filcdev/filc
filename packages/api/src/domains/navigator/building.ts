import z from 'zod';

/**
 * A campus building. `x`/`y` are its origin in the shared world frame the
 * pathfinder works in, so building and classroom coordinates are comparable.
 */
export const buildingSchema = z.object({
  description: z.string(),
  id: z.string(),
  mapped: z.boolean(),
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

export const createBuildingSchema = buildingSchema.omit({
  id: true,
  mapped: true,
});

export const updateBuildingSchema = createBuildingSchema.partial();

export type Building = z.infer<typeof buildingSchema>;
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
