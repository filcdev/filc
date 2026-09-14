import z from 'zod';

/**
 * A "you are here" position. `x`/`y` use the same un-centered world frame as
 * the campus graph (`building.x + entity.x`), and `storey` picks the floor.
 */
export const myLocationSchema = z.object({
  buildingId: z.string().min(1),
  storey: z.number().int(),
  x: z.number(),
  y: z.number(),
});

export type MyLocation = z.infer<typeof myLocationSchema>;
