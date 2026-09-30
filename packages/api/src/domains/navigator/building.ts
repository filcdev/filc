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

/**
 * A building row as the API returns it. Deliberately unconstrained beyond the
 * column types: the campus import writes rows (an empty name is possible) that
 * the API must still be able to read back.
 */
export const buildingRowSchema = z.object({
  description: z.string(),
  id: z.string(),
  mapped: z.boolean(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
});

export type BuildingRow = z.infer<typeof buildingRowSchema>;

/** Payload of `GET /navigator/buildings`. */
export const buildingsResponseSchema = z.object({
  buildings: z.array(buildingRowSchema),
});

/** Payload of `POST /navigator/buildings`, `PUT` and `DELETE /navigator/buildings/{id}`. */
export const buildingResponseSchema = z.object({
  building: buildingRowSchema,
});
