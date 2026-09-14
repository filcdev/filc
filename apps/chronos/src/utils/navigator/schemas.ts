import z from 'zod';
import {
  navigatorCorridor,
  navigatorLift,
  navigatorStair,
  navigatorTranslation,
} from '#database/schema/navigator';
import { building, classroom, classroomType } from '#database/schema/timetable';
import { createSelectSchema } from '#utils/zod';

/** Row schemas derived from the tables, so the docs always match the wire. */
export const buildingSelectSchema = createSelectSchema(building);
export const classroomSelectSchema = createSelectSchema(classroom);
export const classroomTypeSelectSchema = createSelectSchema(classroomType);
export const corridorSelectSchema = createSelectSchema(navigatorCorridor);
export const liftSelectSchema = createSelectSchema(navigatorLift);
export const stairSelectSchema = createSelectSchema(navigatorStair);
export const translationSelectSchema = createSelectSchema(navigatorTranslation);

export const buildingsResponseSchema = z.object({
  data: z.object({ buildings: z.array(buildingSelectSchema) }),
  success: z.literal(true),
});

export const buildingResponseSchema = z.object({
  data: z.object({ building: buildingSelectSchema }),
  success: z.literal(true),
});

export const classroomTypesResponseSchema = z.object({
  data: z.object({ classroom_types: z.array(classroomTypeSelectSchema) }),
  success: z.literal(true),
});

export const classroomTypeResponseSchema = z.object({
  data: z.object({ classroom_type: classroomTypeSelectSchema }),
  success: z.literal(true),
});

export const classroomsResponseSchema = z.object({
  data: z.object({ classrooms: z.array(classroomSelectSchema) }),
  success: z.literal(true),
});

export const classroomResponseSchema = z.object({
  data: z.object({ classroom: classroomSelectSchema }),
  success: z.literal(true),
});

export const corridorsResponseSchema = z.object({
  data: z.object({ corridors: z.array(corridorSelectSchema) }),
  success: z.literal(true),
});

export const corridorResponseSchema = z.object({
  data: z.object({ corridor: corridorSelectSchema }),
  success: z.literal(true),
});

export const liftsResponseSchema = z.object({
  data: z.object({ lifts: z.array(liftSelectSchema) }),
  success: z.literal(true),
});

export const liftResponseSchema = z.object({
  data: z.object({ lift: liftSelectSchema }),
  success: z.literal(true),
});

export const stairsResponseSchema = z.object({
  data: z.object({ stairs: z.array(stairSelectSchema) }),
  success: z.literal(true),
});

export const stairResponseSchema = z.object({
  data: z.object({ stair: stairSelectSchema }),
  success: z.literal(true),
});

/** The whole campus in one payload, in the upstream wire shape. */
export const graphResponseSchema = z.object({
  data: z.object({
    buildings: z.array(buildingSelectSchema),
    classroom_types: z.array(classroomTypeSelectSchema),
    classrooms: z.array(classroomSelectSchema),
    corridors: z.array(corridorSelectSchema),
    lifts: z.array(liftSelectSchema),
    stairs: z.array(stairSelectSchema),
  }),
  success: z.literal(true),
});

export const translationsResponseSchema = z.object({
  data: z.object({ translations: z.array(translationSelectSchema) }),
  success: z.literal(true),
});

export const translationResponseSchema = z.object({
  data: z.object({ translation: translationSelectSchema }),
  success: z.literal(true),
});

/** A flat `text_key -> text` bundle for one language. */
export const translationBundleResponseSchema = z.object({
  data: z.record(z.string(), z.string()),
  success: z.literal(true),
});

export const languagesResponseSchema = z.object({
  data: z.object({ languages: z.array(z.string()) }),
  success: z.literal(true),
});
