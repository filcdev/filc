import z from 'zod';

/**
 * A building row as the API returns it: the columns, deliberately unconstrained
 * beyond their types. The campus import writes rows (an empty name is possible)
 * that the API must still be able to read back, so the read shape cannot carry
 * the write-time `min(1)`.
 *
 * This is the base definition; the write shape narrows it (see below). Deriving
 * one from the other is what keeps them from drifting — a column added here
 * reaches both.
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

/** A campus building. `x`/`y` are its origin in the shared world frame the
 * pathfinder works in, so building and classroom coordinates are comparable. */
export const buildingSchema = buildingRowSchema.extend({
  name: z.string().min(1),
});

export const createBuildingSchema = buildingSchema.omit({
  id: true,
  mapped: true,
});

export const updateBuildingSchema = createBuildingSchema.partial();

export type Building = z.infer<typeof buildingSchema>;
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
