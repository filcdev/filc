import z from 'zod';

/**
 * A stair row as the API returns it: the columns, unconstrained beyond their
 * types (see `buildingRowSchema` for why). The base definition; the write shape
 * narrows it.
 *
 * The field set is a lift's plus `rotation`, but declared here rather than
 * derived from `liftSchema`: the two are separate tables, and deriving one
 * domain entity's write shape from another's would couple a change to a lift to
 * every stair.
 */
export const stairRowSchema = z.object({
  building_id: z.string(),
  createdAt: z.date(),
  id: z.string(),
  max_storey: z.number().int(),
  min_storey: z.number().int(),
  name: z.string(),
  rotation: z.number(),
  updatedAt: z.date(),
  x: z.number(),
  y: z.number(),
});

export type StairRow = z.infer<typeof stairRowSchema>;

/** A stairwell in a building. */
export const stairSchema = stairRowSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({
    building_id: z.string().min(1),
    name: z.string().min(1),
  });

export const createStairSchema = stairSchema.omit({ id: true });

export const updateStairSchema = createStairSchema.partial();

export type Stair = z.infer<typeof stairSchema>;
export type CreateStairInput = z.infer<typeof createStairSchema>;
export type UpdateStairInput = z.infer<typeof updateStairSchema>;
