import z from 'zod';
import {
  navigatorBuilding,
  navigatorClassroom,
  navigatorClassroomType,
  navigatorCorridor,
  navigatorLift,
  navigatorStair,
  navigatorTranslation,
} from '#database/schema/navigator';
import { createSelectSchema } from '#utils/zod';

export const buildingSelectSchema = createSelectSchema(navigatorBuilding);
export const classroomTypeSelectSchema = createSelectSchema(
  navigatorClassroomType
);
export const classroomSelectSchema = createSelectSchema(navigatorClassroom);
export const corridorSelectSchema = createSelectSchema(navigatorCorridor);
export const liftSelectSchema = createSelectSchema(navigatorLift);
export const stairSelectSchema = createSelectSchema(navigatorStair);
export const translationSelectSchema = createSelectSchema(navigatorTranslation);

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

export const corridorResponseSchema = z.object({
  data: z.object({ corridor: corridorSelectSchema }),
  success: z.literal(true),
});

export const corridorsResponseSchema = z.object({
  data: z.object({ corridors: z.array(corridorSelectSchema) }),
  success: z.literal(true),
});

export const liftResponseSchema = z.object({
  data: z.object({ lift: liftSelectSchema }),
  success: z.literal(true),
});

export const liftsResponseSchema = z.object({
  data: z.object({ lifts: z.array(liftSelectSchema) }),
  success: z.literal(true),
});

export const stairResponseSchema = z.object({
  data: z.object({ stair: stairSelectSchema }),
  success: z.literal(true),
});

export const stairsResponseSchema = z.object({
  data: z.object({ stairs: z.array(stairSelectSchema) }),
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
    corridors: z.array(corridorSelectSchema),
    lifts: z.array(liftSelectSchema),
    stairs: z.array(stairSelectSchema),
  }),
  success: z.literal(true),
});
