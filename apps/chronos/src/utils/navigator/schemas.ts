import z from 'zod';
import {
  navigatorBuilding,
  navigatorClassroom,
  navigatorClassroomType,
  navigatorTranslation,
  navigatorUtility,
} from '#database/schema/navigator';
import { createSelectSchema } from '#utils/zod';

export const buildingSelectSchema = createSelectSchema(navigatorBuilding);
export const classroomTypeSelectSchema = createSelectSchema(
  navigatorClassroomType
);
export const classroomSelectSchema = createSelectSchema(navigatorClassroom);
export const translationSelectSchema = createSelectSchema(navigatorTranslation);

const utilityBaseSelectSchema = createSelectSchema(navigatorUtility);

const corridorUtilitySelectSchema = utilityBaseSelectSchema.extend({
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

const liftUtilitySelectSchema = utilityBaseSelectSchema.extend({
  kind: z.literal('lift'),
  maxStorey: z.number(),
  minStorey: z.number(),
  x: z.number(),
  y: z.number(),
});

const stairUtilitySelectSchema = utilityBaseSelectSchema.extend({
  kind: z.literal('stair'),
  maxStorey: z.number(),
  minStorey: z.number(),
  rotation: z.number(),
  x: z.number(),
  y: z.number(),
});

export const utilitySelectSchema = z.discriminatedUnion('kind', [
  corridorUtilitySelectSchema,
  liftUtilitySelectSchema,
  stairUtilitySelectSchema,
]);

export const buildingResponseSchema = z.object({
  data: z.object({ building: buildingSelectSchema }),
  success: z.literal(true),
});

export const buildingsResponseSchema = z.object({
  data: z.object({ buildings: z.array(buildingSelectSchema) }),
  success: z.literal(true),
});

export const classroomTypeResponseSchema = z.object({
  data: z.object({ classroomType: classroomTypeSelectSchema }),
  success: z.literal(true),
});

export const classroomTypesResponseSchema = z.object({
  data: z.object({ classroomTypes: z.array(classroomTypeSelectSchema) }),
  success: z.literal(true),
});

export const classroomResponseSchema = z.object({
  data: z.object({ classroom: classroomSelectSchema }),
  success: z.literal(true),
});

export const classroomsResponseSchema = z.object({
  data: z.object({ classrooms: z.array(classroomSelectSchema) }),
  success: z.literal(true),
});

export const utilityResponseSchema = z.object({
  data: z.object({ utility: utilitySelectSchema }),
  success: z.literal(true),
});

export const utilitiesResponseSchema = z.object({
  data: z.object({ utilities: z.array(utilitySelectSchema) }),
  success: z.literal(true),
});

export const translationResponseSchema = z.object({
  data: z.object({ translation: translationSelectSchema }),
  success: z.literal(true),
});

export const translationsResponseSchema = z.object({
  data: z.object({ translations: z.array(translationSelectSchema) }),
  success: z.literal(true),
});

export const translationMapResponseSchema = z.object({
  data: z.record(z.string(), z.string()),
  success: z.literal(true),
});

export const translationAvailableResponseSchema = z.object({
  data: z.array(z.string()),
  success: z.literal(true),
});

export const graphResponseSchema = z.object({
  data: z.object({
    buildings: z.array(buildingSelectSchema),
    classrooms: z.array(classroomSelectSchema),
    classroomTypes: z.array(classroomTypeSelectSchema),
    utilities: z.array(utilitySelectSchema),
  }),
  success: z.literal(true),
});
