import z from 'zod';
import {
  buildingSelectSchema,
  classroomSelectSchema,
  classroomTypeSelectSchema,
  corridorSelectSchema,
  liftSelectSchema,
  stairSelectSchema,
  translationSelectSchema,
} from '#utils/navigator/schemas';

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

export const corridorTransferSchema = corridorSelectSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const liftTransferSchema = liftSelectSchema
  .omit({ createdAt: true, updatedAt: true })
  .refine((data) => data.minStorey <= data.maxStorey, {
    message: 'minStorey must be less than or equal to maxStorey',
    path: ['minStorey'],
  });

export const stairTransferSchema = stairSelectSchema
  .omit({ createdAt: true, updatedAt: true })
  .refine((data) => data.minStorey <= data.maxStorey, {
    message: 'minStorey must be less than or equal to maxStorey',
    path: ['minStorey'],
  });

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
  corridors: z.array(corridorTransferSchema),
  lifts: z.array(liftTransferSchema),
  stairs: z.array(stairTransferSchema),
  translations: z.array(translationTransferSchema),
});

export type NavigatorTransfer = z.infer<typeof navigatorTransferSchema>;
