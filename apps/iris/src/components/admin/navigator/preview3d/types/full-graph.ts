import type { Building } from './navigator/building';
import type { Classroom } from './navigator/classroom';
import type { ClassroomType } from './navigator/classroom-type';
import type { Corridor } from './navigator/corridor';
import type { Lift } from './navigator/lift';
import type { Stair } from './navigator/stair';

export type FullGraph = {
  buildings: Building[];
  classrooms: Classroom[];
  classroom_types: ClassroomType[];
  corridors: Corridor[];
  lifts: Lift[];
  stairs: Stair[];
};
