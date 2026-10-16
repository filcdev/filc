import z from 'zod';
import { buildingRowSchema } from './building';
import { classroomRowSchema } from './classroom';
import { classroomTypeRowSchema } from './classroom-type';
import { corridorRowSchema } from './corridor';
import { liftRowSchema } from './lift';
import { stairRowSchema } from './stair';

/**
 * The whole campus in one payload: what the kiosk canvas and the admin editor
 * both build their scene from.
 *
 * Built from the `*Row` shapes, not the write shapes: a room the timetable
 * imported has a null `type_id`/`capacity` and a building can carry an empty
 * name, and the graph has to be readable in exactly the state the import left
 * it. oRPC validates this at runtime, so a stricter shape here turns those
 * rows into a 500 for every consumer.
 */
export const fullGraphSchema = z.object({
  buildings: z.array(buildingRowSchema),
  classroom_types: z.array(classroomTypeRowSchema),
  classrooms: z.array(classroomRowSchema),
  corridors: z.array(corridorRowSchema),
  lifts: z.array(liftRowSchema),
  stairs: z.array(stairRowSchema),
});

export type FullGraph = z.infer<typeof fullGraphSchema>;
