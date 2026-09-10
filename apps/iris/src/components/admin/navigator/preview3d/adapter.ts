import type { NavigatorGraph } from '@/hooks/navigator';
import type { FullGraph } from './types/full-graph';

/**
 * Converts filc's `NavigatorGraph` (camelCase fields, utilities split by
 * `kind`) into the snake_case `FullGraph` shape the ported Three.js
 * builders consume.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: mechanical camelCase→snake_case mapping across three utility kinds
export function toFullGraph(graph: NavigatorGraph): FullGraph {
  const corridors: FullGraph['corridors'] = [];
  const lifts: FullGraph['lifts'] = [];
  const stairs: FullGraph['stairs'] = [];

  for (const u of graph.utilities) {
    if (u.kind === 'corridor') {
      corridors.push({
        barrier_free: u.barrierFree ?? false,
        building_id: u.buildingId,
        id: u.id,
        is_outdoor: u.isOutdoor ?? false,
        name: u.name,
        storey: u.storey ?? 0,
        width: u.width ?? 0,
        x1: u.x1 ?? 0,
        x2: u.x2 ?? 0,
        y1: u.y1 ?? 0,
        y2: u.y2 ?? 0,
      });
    } else if (u.kind === 'lift') {
      lifts.push({
        building_id: u.buildingId,
        id: u.id,
        max_storey: u.maxStorey ?? 0,
        min_storey: u.minStorey ?? 0,
        name: u.name,
        x: u.x ?? 0,
        y: u.y ?? 0,
      });
    } else {
      stairs.push({
        building_id: u.buildingId,
        id: u.id,
        max_storey: u.maxStorey ?? 0,
        min_storey: u.minStorey ?? 0,
        name: u.name,
        rotation: u.rotation ?? 0,
        x: u.x ?? 0,
        y: u.y ?? 0,
      });
    }
  }

  return {
    buildings: graph.buildings.map((b) => ({
      description: b.description,
      id: b.id,
      name: b.name,
      x: b.x,
      y: b.y,
    })),
    classroom_types: graph.classroomTypes.map((t) => ({
      colorhex: t.colorhex,
      id: t.id,
      name: t.name,
    })),
    classrooms: graph.classrooms.map((c) => ({
      building_id: c.buildingId,
      capacity: c.capacity,
      description: c.description,
      id: c.id,
      name: c.name,
      rotation: c.rotation,
      size_x: c.sizeX,
      size_y: c.sizeY,
      size_z: c.sizeZ,
      storey: c.storey,
      type_id: c.typeId,
      x: c.x,
      y: c.y,
    })),
    corridors,
    lifts,
    stairs,
  };
}
