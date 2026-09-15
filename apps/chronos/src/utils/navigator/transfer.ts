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
 *
 * `building`, `classroom` and `navigatorTranslation` carry no timestamps, so
 * those reuse the select schema as-is; the `.omit` calls below strip the
 * audit columns from the tables that have them.
 */

export const buildingTransferSchema = buildingSelectSchema;

export const classroomTypeTransferSchema = classroomTypeSelectSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const classroomTransferSchema = classroomSelectSchema;

export const corridorTransferSchema = corridorSelectSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const liftTransferSchema = liftSelectSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const stairTransferSchema = stairSelectSchema.omit({
  createdAt: true,
  updatedAt: true,
});

/** `navigator_translation` has no timestamps, so it transfers as-is. */
export const translationTransferSchema = translationSelectSchema;

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

/**
 * Import validates the storey range; export must not, because a pre-existing
 * row could already violate it (the DB has no such check constraint).
 */
const storeyRangeRule = {
  message: 'min_storey must be less than or equal to max_storey',
  path: ['min_storey'],
};

const liftImportRowSchema = liftTransferSchema.refine(
  (data) => data.min_storey <= data.max_storey,
  storeyRangeRule
);

const stairImportRowSchema = stairTransferSchema.refine(
  (data) => data.min_storey <= data.max_storey,
  storeyRangeRule
);

export const navigatorImportSchema = navigatorTransferSchema.extend({
  lifts: z.array(liftImportRowSchema),
  stairs: z.array(stairImportRowSchema),
});

/**
 * Query options for the import route. `clear` is a string enum (not a coerced
 * boolean, since `Boolean('false')` is `true`): only `"true"` wipes existing
 * navigator data first.
 */
export const importQuerySchema = z.object({
  clear: z.enum(['true', 'false']).optional(),
});

export const navigatorTransferResponseSchema = z.object({
  data: navigatorTransferSchema,
  success: z.literal(true),
});

export const navigatorImportResponseSchema = z.object({
  data: z.object({
    buildings: z.number(),
    classrooms: z.number(),
    classroomTypes: z.number(),
    corridors: z.number(),
    lifts: z.number(),
    stairs: z.number(),
    translations: z.number(),
  }),
  success: z.literal(true),
});
