import z from 'zod';
import { liftSchema } from './lift';

/** A staircase: a lift shaft that also has an orientation. */
export const stairSchema = liftSchema.extend({ rotation: z.number() });

export const createStairSchema = stairSchema.omit({ id: true });

export const updateStairSchema = createStairSchema.partial();

export type Stair = z.infer<typeof stairSchema>;
export type CreateStairInput = z.infer<typeof createStairSchema>;
export type UpdateStairInput = z.infer<typeof updateStairSchema>;

/** A staircase row as the API returns it (see `buildingRowSchema`). */
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

/** Payload of `GET /navigator/stairs`. */
export const stairsResponseSchema = z.object({
  stairs: z.array(stairRowSchema),
});

/** Payload of `POST /navigator/stairs`, `PUT` and `DELETE /navigator/stairs/{id}`. */
export const stairResponseSchema = z.object({
  stair: stairRowSchema,
});
