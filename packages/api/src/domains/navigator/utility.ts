import z from 'zod';

const int16 = z.number().int().min(-32_768).max(32_767);

const corridorFields = {
  buildingId: z.uuid(),
  name: z.string().min(1).max(254),
  storey: int16,
  width: z.number().min(0.5).max(20),
  x1: int16,
  x2: int16,
  y1: int16,
  y2: int16,
};

const liftFields = {
  buildingId: z.uuid(),
  maxStorey: int16,
  minStorey: int16,
  name: z.string().min(1).max(190),
  x: int16,
  y: int16,
};

const stairFields = {
  buildingId: z.uuid(),
  maxStorey: int16,
  minStorey: int16,
  name: z.string().min(1).max(190),
  rotation: z.number().int().min(0).max(360),
  x: int16,
  y: int16,
};

const storeyRangeRefine = {
  message: 'minStorey must be less than or equal to maxStorey',
  path: ['minStorey'] as string[],
};

/**
 * Payload for creating a navigator utility. The `kind` discriminator selects
 * which kind-specific columns are required; the others are left NULL in the
 * database.
 */
export const createUtilitySchema = z
  .discriminatedUnion('kind', [
    z.object({
      ...corridorFields,
      barrierFree: z.boolean().default(false),
      isOutdoor: z.boolean().default(false),
      kind: z.literal('corridor'),
    }),
    z.object({ ...liftFields, kind: z.literal('lift') }),
    z.object({ ...stairFields, kind: z.literal('stair') }),
  ])
  .refine(
    (data) => data.kind === 'corridor' || data.minStorey <= data.maxStorey,
    storeyRangeRefine
  );

/**
 * Payload for updating a navigator utility. `kind` is fixed per variant, and
 * the kind-specific fields are all optional.
 */
export const updateUtilitySchema = z
  .discriminatedUnion('kind', [
    z
      .object({ ...corridorFields })
      .partial()
      .extend({
        barrierFree: z.boolean().optional(),
        isOutdoor: z.boolean().optional(),
        kind: z.literal('corridor'),
      }),
    z
      .object({ ...liftFields })
      .partial()
      .extend({ kind: z.literal('lift') }),
    z
      .object({ ...stairFields })
      .partial()
      .extend({ kind: z.literal('stair') }),
  ])
  .refine(
    (data) =>
      data.kind === 'corridor' ||
      data.minStorey === undefined ||
      data.maxStorey === undefined ||
      data.minStorey <= data.maxStorey,
    storeyRangeRefine
  );

export type CreateUtilityInput = z.infer<typeof createUtilitySchema>;
export type UpdateUtilityInput = z.infer<typeof updateUtilitySchema>;

/** The discriminator values for a navigator utility. */
export const utilityKinds = ['corridor', 'lift', 'stair'] as const;
export type UtilityKind = (typeof utilityKinds)[number];

/** Query parameters for listing utilities, optionally filtered by kind. */
export const utilityKindQuerySchema = z.object({
  kind: z.enum(utilityKinds).optional(),
});
