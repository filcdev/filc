import type { Building } from '@filcdev/api/domains/navigator/building';
import type { Classroom } from '@filcdev/api/domains/navigator/classroom';
import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import { FLOOR_GAP } from '../scene/storey-resolver';

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

/** Min/max storey present anywhere in the graph (classrooms + corridors).
 *  Used to clamp the user's "my location" storey to the floors that
 *  actually exist. Falls back to {min:0, max:0} for an empty graph. */
export function getStoreyRange(graph: FullGraph): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const c of graph.classrooms) {
    if (c.storey < min) {
      min = c.storey;
    }
    if (c.storey > max) {
      max = c.storey;
    }
  }
  for (const cor of graph.corridors) {
    if (cor.storey < min) {
      min = cor.storey;
    }
    if (cor.storey > max) {
      max = cor.storey;
    }
  }
  if (min === Number.POSITIVE_INFINITY) {
    return { max: 0, min: 0 };
  }
  return { max, min };
}

export function floorPositionOf(
  graph: FullGraph,
  buildingId: string,
  storey: number
): number {
  let startPos = 0;
  if (storey >= 0) {
    for (let i = 0; i < storey; i++) {
      startPos += ceilingHeight(graph, buildingId, i) + FLOOR_GAP;
    }
  } else {
    for (let i = -1; i >= storey; i--) {
      startPos -= ceilingHeight(graph, buildingId, i) + FLOOR_GAP;
    }
  }
  return startPos;
}

function ceilingHeight(
  graph: FullGraph,
  buildingId: string,
  storey: number
): number {
  let maxH = 0;
  for (const c of graph.classrooms) {
    if (
      c.building_id === buildingId &&
      c.storey === storey &&
      c.size_z > maxH
    ) {
      maxH = c.size_z;
    }
  }
  return maxH;
}
