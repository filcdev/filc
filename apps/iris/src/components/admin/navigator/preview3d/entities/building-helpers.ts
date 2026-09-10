import type { FullGraph } from '../types/full-graph';
import type { Building } from '../types/navigator/building';
import type { Classroom } from '../types/navigator/classroom';

export function getClassroomsInBuilding(
  graph: FullGraph,
  building: Building
): Classroom[] {
  return graph.classrooms.filter((c) => c.building_id === building.id);
}

export function getValidStoreys(rooms: Classroom[]): number[] {
  const set = new Set<number>();
  set.add(0);
  for (const r of rooms) {
    set.add(r.storey);
  }
  return Array.from(set);
}
