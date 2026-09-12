import z from 'zod';
import { navigatorUtility } from '#database/schema/navigator';
import {
  buildingSelectSchema,
  classroomSelectSchema,
  classroomTypeSelectSchema,
  translationSelectSchema,
} from '#utils/navigator/schemas';
import { createSelectSchema } from '#utils/zod';

/**
 * Transfer schemas for navigator export/import. Each strips the audit
 * timestamps (regenerated from DB defaults on import) and keeps the remaining
 * column keys exactly as the drizzle schema names them, so a JSON file can be
 * round-tripped through the DB without losing ids or FK references.
 */

export const buildingTransferSchema = buildingSelectSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const classroomTypeTransferSchema = classroomTypeSelectSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const classroomTransferSchema = classroomSelectSchema.omit({
  createdAt: true,
  updatedAt: true,
});

const utilityBaseTransferSchema = createSelectSchema(navigatorUtility).omit({
  createdAt: true,
  updatedAt: true,
});

const storeyRangeRefine = {
  message: 'minStorey must be less than or equal to maxStorey',
  path: ['minStorey'] as string[],
};

const corridorUtilityTransferSchema = utilityBaseTransferSchema.extend({
  barrierFree: z.boolean(),
  isOutdoor: z.boolean(),
  kind: z.literal('corridor'),
  storey: z.number(),
  width: z.number(),
  x1: z.number(),
  x2: z.number(),
  y1: z.number(),
  y2: z.number(),
});

const liftUtilityTransferSchema = utilityBaseTransferSchema.extend({
  kind: z.literal('lift'),
  maxStorey: z.number(),
  minStorey: z.number(),
  x: z.number(),
  y: z.number(),
});

const stairUtilityTransferSchema = utilityBaseTransferSchema.extend({
  kind: z.literal('stair'),
  maxStorey: z.number(),
  minStorey: z.number(),
  rotation: z.number(),
  x: z.number(),
  y: z.number(),
});

export const utilityTransferSchema = z
  .discriminatedUnion('kind', [
    corridorUtilityTransferSchema,
    liftUtilityTransferSchema,
    stairUtilityTransferSchema,
  ])
  .refine(
    (data) => data.kind === 'corridor' || data.minStorey <= data.maxStorey,
    storeyRangeRefine
  );

export const translationTransferSchema = translationSelectSchema.omit({
  createdAt: true,
  updatedAt: true,
});

// biome-ignore assist/source/useSortedKeys: canonical transfer field order (version first)
export const navigatorTransferSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  buildings: z.array(buildingTransferSchema),
  classroomTypes: z.array(classroomTypeTransferSchema),
  classrooms: z.array(classroomTransferSchema),
  utilities: z.array(utilityTransferSchema),
  translations: z.array(translationTransferSchema),
});

export type NavigatorTransfer = z.infer<typeof navigatorTransferSchema>;
