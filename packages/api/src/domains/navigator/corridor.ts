import z from 'zod';

/** A corridor segment on a storey; `x1`/`y1`–`x2`/`y2` is its centre line. */
export const corridorSchema = z.object({
  barrier_free: z.boolean(),
  building_id: z.string().min(1),
  id: z.string(),
  is_outdoor: z.boolean(),
  name: z.string().min(1),
  storey: z.number().int(),
  width: z.number(),
  x1: z.number(),
  x2: z.number(),
  y1: z.number(),
  y2: z.number(),
});

export const createCorridorSchema = corridorSchema.omit({ id: true });

export const updateCorridorSchema = createCorridorSchema.partial();

export type Corridor = z.infer<typeof corridorSchema>;
export type CreateCorridorInput = z.infer<typeof createCorridorSchema>;
export type UpdateCorridorInput = z.infer<typeof updateCorridorSchema>;
