import z from 'zod';
import { liftSchema } from './lift';

/** A staircase: a lift shaft that also has an orientation. */
export const stairSchema = liftSchema.extend({ rotation: z.number() });

export const createStairSchema = stairSchema.omit({ id: true });

export const updateStairSchema = createStairSchema.partial();

export type Stair = z.infer<typeof stairSchema>;
export type CreateStairInput = z.infer<typeof createStairSchema>;
export type UpdateStairInput = z.infer<typeof updateStairSchema>;
