import z from 'zod';

/** A lift shaft connecting `min_storey`..`max_storey` in one building. */
export const liftSchema = z.object({
  building_id: z.string().min(1),
  id: z.string(),
  max_storey: z.number().int(),
  min_storey: z.number().int(),
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

export const createLiftSchema = liftSchema.omit({ id: true });

export const updateLiftSchema = createLiftSchema.partial();

export type Lift = z.infer<typeof liftSchema>;
export type CreateLiftInput = z.infer<typeof createLiftSchema>;
export type UpdateLiftInput = z.infer<typeof updateLiftSchema>;

/** A lift row as the API returns it (see `buildingRowSchema`). */
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

/** Payload of `GET /navigator/lifts`. */
export const liftsResponseSchema = z.object({
  lifts: z.array(liftRowSchema),
});

/** Payload of `POST /navigator/lifts`, `PUT` and `DELETE /navigator/lifts/{id}`. */
export const liftResponseSchema = z.object({
  lift: liftRowSchema,
});
