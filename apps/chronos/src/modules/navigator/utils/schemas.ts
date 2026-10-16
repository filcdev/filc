import {
  navigatorCorridor,
  navigatorLift,
  navigatorStair,
  navigatorTranslation,
} from '#modules/navigator/schema';
import { building, classroom, classroomType } from '#modules/timetable/schema';
import { createSelectSchema } from '#utils/zod';

/** Row schemas derived from the tables, so the docs always match the wire. */
export const buildingSelectSchema = createSelectSchema(building);
export const classroomSelectSchema = createSelectSchema(classroom);
export const classroomTypeSelectSchema = createSelectSchema(classroomType);
export const corridorSelectSchema = createSelectSchema(navigatorCorridor);
export const liftSelectSchema = createSelectSchema(navigatorLift);
export const stairSelectSchema = createSelectSchema(navigatorStair);
export const translationSelectSchema = createSelectSchema(navigatorTranslation);
