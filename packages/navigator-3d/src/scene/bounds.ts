import type { Building } from '@filcdev/api/domains/navigator/building';
import type { Classroom } from '@filcdev/api/domains/navigator/classroom';
import type { Corridor } from '@filcdev/api/domains/navigator/corridor';
import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import { degToRad } from 'three/src/math/MathUtils.js';

export type LocalBounds = { x: number; y: number; w: number; h: number };
export type Vector2 = { x: number; y: number };

function GetRoomBounds(building: Building, classroom: Classroom): LocalBounds {
  const origin = { x: building.x, y: building.y };

  const rot = degToRad(classroom.rotation);
  const s = Math.sin(rot);
  const c = Math.cos(rot);

  const center = { x: origin.x + classroom.x, y: origin.y + classroom.y };
  const half = { x: classroom.size_x * 0.5, y: classroom.size_y * 0.5 };

  const corners = [
    { x: -half.x, y: -half.y },
    { x: half.x, y: -half.y },
    { x: half.x, y: half.y },
    { x: -half.x, y: half.y },
  ];

  const min_v = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY };
  const max_v = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY };

  for (const corner of corners) {
    const rotated = {
      x: corner.x * c - corner.y * s,
      y: corner.x * s + corner.y * c,
    };

    const world = { x: center.x + rotated.x, y: center.y + rotated.y };

    min_v.x = Math.min(min_v.x, world.x);
    min_v.y = Math.min(min_v.y, world.y);
    max_v.x = Math.max(max_v.x, world.x);
    max_v.y = Math.max(max_v.y, world.y);
  }

  return { h: max_v.y - min_v.y, w: max_v.x - min_v.x, x: min_v.x, y: min_v.y };
}

function GetCorridorBounds(
  building: Building,
  corridor: Corridor
): LocalBounds {
  const { x1: cx1, y1: cy1, x2: cx2, y2: cy2, width } = corridor;

  const x1 = building.x + cx1;
  const y1 = building.y + cy1;
  const x2 = building.x + cx2;
  const y2 = building.y + cy2;

  const dx = x2 - x1;
  const dy = y2 - y1;

  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return {
      h: width,
      w: width,
      x: x1 - width / 2,
      y: y1 - width / 2,
    };
  }

  const px = -dy / length;
  const py = dx / length;

  const hw = width / 2;

  const corners = [
    { x: x1 + px * hw, y: y1 + py * hw },
    { x: x1 - px * hw, y: y1 - py * hw },
    { x: x2 + px * hw, y: y2 + py * hw },
    { x: x2 - px * hw, y: y2 - py * hw },
  ];

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    h: maxY - minY,
    w: maxX - minX,
    x: minX,
    y: minY,
  };
}

function GetBoundsByClassrooms(
  building: Building,
  classrooms: Classroom[]
): LocalBounds {
  if (classrooms.length === 0) {
    return { h: 0, w: 0, x: 0, y: 0 };
  }

  let min_x = Number.POSITIVE_INFINITY;
  let min_y = Number.POSITIVE_INFINITY;
  let max_x = Number.NEGATIVE_INFINITY;
  let max_y = Number.NEGATIVE_INFINITY;

  for (const classroom of classrooms) {
    const aabb = GetRoomBounds(building, classroom);
    min_x = Math.min(min_x, aabb.x);
    min_y = Math.min(min_y, aabb.y);
    max_x = Math.max(max_x, aabb.x + aabb.w);
    max_y = Math.max(max_y, aabb.y + aabb.h);
  }

  return { h: max_y - min_y, w: max_x - min_x, x: min_x, y: min_y };
}

function GetBoundsByCorridors(
  building: Building,
  corridors: Corridor[]
): LocalBounds {
  if (corridors.length === 0) {
    return { h: 0, w: 0, x: 0, y: 0 };
  }

  let min_x = Number.POSITIVE_INFINITY;
  let min_y = Number.POSITIVE_INFINITY;
  let max_x = Number.NEGATIVE_INFINITY;
  let max_y = Number.NEGATIVE_INFINITY;

  for (const corridor of corridors) {
    const aabb = GetCorridorBounds(building, corridor);

    min_x = Math.min(min_x, aabb.x);
    min_y = Math.min(min_y, aabb.y);
    max_x = Math.max(max_x, aabb.x + aabb.w);
    max_y = Math.max(max_y, aabb.y + aabb.h);
  }

  return { h: max_y - min_y, w: max_x - min_x, x: min_x, y: min_y };
}

export function GetBuildingBounds(
  building: Building,
  graph: FullGraph
): LocalBounds {
  const roomBounds = GetBoundsByClassrooms(
    building,
    graph.classrooms.filter((x) => x.building_id === building.id)
  );
  const corridorBounds = GetBoundsByCorridors(
    building,
    graph.corridors.filter(
      (x) => x.building_id === building.id && !x.is_outdoor
    )
  );

  let min_x = Number.POSITIVE_INFINITY;
  let min_y = Number.POSITIVE_INFINITY;
  let max_x = Number.NEGATIVE_INFINITY;
  let max_y = Number.NEGATIVE_INFINITY;

  min_x = Math.min(min_x, roomBounds.x);
  min_y = Math.min(min_y, roomBounds.y);
  max_x = Math.max(max_x, roomBounds.x + roomBounds.w);
  max_y = Math.max(max_y, roomBounds.y + roomBounds.h);

  min_x = Math.min(min_x, corridorBounds.x);
  min_y = Math.min(min_y, corridorBounds.y);
  max_x = Math.max(max_x, corridorBounds.x + corridorBounds.w);
  max_y = Math.max(max_y, corridorBounds.y + corridorBounds.h);

  if (
    roomBounds.w === 0 &&
    roomBounds.h === 0 &&
    corridorBounds.w === 0 &&
    corridorBounds.h === 0
  ) {
    min_x = -10 + building.x;
    min_y = -10 + building.y;
    max_x = 10 + building.x;
    max_y = 10 + building.y;
  }

  return { h: max_y - min_y, w: max_x - min_x, x: min_x, y: min_y };
}

// Computed from the SAVED graph (not the merged preview) so dragging a
// gizmo doesn't shift the world out from under the cursor.
export function computeCampusCenter(graph: FullGraph): Vector2 {
  let minX = Number.POSITIVE_INFINITY,
    minZ = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY,
    maxZ = Number.NEGATIVE_INFINITY;

  if (graph.buildings.length === 0) {
    return { x: 0, y: 0 };
  }

  for (const b of graph.buildings) {
    const rooms = graph.classrooms.filter((c) => c.building_id === b.id);
    const bounds = GetBoundsByClassrooms(b, rooms);

    minX = Math.min(minX, bounds.x);
    minZ = Math.min(minZ, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.w);
    maxZ = Math.max(maxZ, bounds.y + bounds.h);
  }

  return { x: (minX + maxX) / 2, y: (minZ + maxZ) / 2 };
}
