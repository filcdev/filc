import z from 'zod';

/**
 * A corridor row as the API returns it: the columns, unconstrained beyond their
 * types (see `buildingRowSchema` for why). The base definition; the write shape
 * narrows it.
 */
export const corridorRowSchema = z.object({
  barrier_free: z.boolean(),
  building_id: z.string(),
  createdAt: z.date(),
  id: z.string(),
  is_outdoor: z.boolean(),
  name: z.string(),
  storey: z.number().int(),
  updatedAt: z.date(),
  width: z.number(),
  x1: z.number(),
  x2: z.number(),
  y1: z.number(),
  y2: z.number(),
});

export type CorridorRow = z.infer<typeof corridorRowSchema>;

/** A corridor on a storey of a building. */
export const corridorSchema = corridorRowSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({
    building_id: z.string().min(1),
    name: z.string().min(1),
  });

export const createCorridorSchema = corridorSchema.omit({ id: true });

export const updateCorridorSchema = createCorridorSchema.partial();

export type Corridor = z.infer<typeof corridorSchema>;
export type CreateCorridorInput = z.infer<typeof createCorridorSchema>;
export type UpdateCorridorInput = z.infer<typeof updateCorridorSchema>;
