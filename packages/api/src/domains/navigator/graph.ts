import z from 'zod';
import { buildingSchema } from './building';
import { classroomSchema } from './classroom';
import { classroomTypeSchema } from './classroom-type';
import { corridorSchema } from './corridor';
import { liftSchema } from './lift';
import { stairSchema } from './stair';

/**
 * The whole campus in one payload: what the kiosk canvas and the admin editor
 * both build their scene from.
 */
export const fullGraphSchema = z.object({
  buildings: z.array(buildingSchema),
  classroom_types: z.array(classroomTypeSchema),
  classrooms: z.array(classroomSchema),
  corridors: z.array(corridorSchema),
  lifts: z.array(liftSchema),
  stairs: z.array(stairSchema),
});

export type FullGraph = z.infer<typeof fullGraphSchema>;
