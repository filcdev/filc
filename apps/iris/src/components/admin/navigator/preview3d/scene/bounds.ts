import { MathUtils } from 'three';
import type { FullGraph } from '../types/full-graph';
import type { Building } from '../types/navigator/building';
import type { Classroom } from '../types/navigator/classroom';
import type { Corridor } from '../types/navigator/corridor';

export type LocalBounds = { x: number; y: number; w: number; h: number };
export type Vector2 = { x: number; y: number };

function GetRoomBounds(building: Building, classroom: Classroom): LocalBounds {
  const origin = { x: building.x, y: building.y };

  const rot = MathUtils.degToRad(classroom.rotation);
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

  const minV = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY };
  const maxV = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY };

  for (const corner of corners) {
    const rotated = {
      x: corner.x * c - corner.y * s,
      y: corner.x * s + corner.y * c,
    };

    const world = { x: center.x + rotated.x, y: center.y + rotated.y };

    minV.x = Math.min(minV.x, world.x);
    minV.y = Math.min(minV.y, world.y);
    maxV.x = Math.max(maxV.x, world.x);
    maxV.y = Math.max(maxV.y, world.y);
  }

  return { h: maxV.y - minV.y, w: maxV.x - minV.x, x: minV.x, y: minV.y };
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

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const classroom of classrooms) {
    const aabb = GetRoomBounds(building, classroom);
    minX = Math.min(minX, aabb.x);
    minY = Math.min(minY, aabb.y);
    maxX = Math.max(maxX, aabb.x + aabb.w);
    maxY = Math.max(maxY, aabb.y + aabb.h);
  }

  return { h: maxY - minY, w: maxX - minX, x: minX, y: minY };
}

function GetBoundsByCorridors(
  building: Building,
  corridors: Corridor[]
): LocalBounds {
  if (corridors.length === 0) {
    return { h: 0, w: 0, x: 0, y: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const corridor of corridors) {
    const aabb = GetCorridorBounds(building, corridor);

    minX = Math.min(minX, aabb.x);
    minY = Math.min(minY, aabb.y);
    maxX = Math.max(maxX, aabb.x + aabb.w);
    maxY = Math.max(maxY, aabb.y + aabb.h);
  }

  return { h: maxY - minY, w: maxX - minX, x: minX, y: minY };
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

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  minX = Math.min(minX, roomBounds.x);
  minY = Math.min(minY, roomBounds.y);
  maxX = Math.max(maxX, roomBounds.x + roomBounds.w);
  maxY = Math.max(maxY, roomBounds.y + roomBounds.h);

  minX = Math.min(minX, corridorBounds.x);
  minY = Math.min(minY, corridorBounds.y);
  maxX = Math.max(maxX, corridorBounds.x + corridorBounds.w);
  maxY = Math.max(maxY, corridorBounds.y + corridorBounds.h);

  if (
    roomBounds.w === 0 &&
    roomBounds.h === 0 &&
    corridorBounds.w === 0 &&
    corridorBounds.h === 0
  ) {
    minX = -10 + building.x;
    minY = -10 + building.y;
    maxX = 10 + building.x;
    maxY = 10 + building.y;
  }

  return { h: maxY - minY, w: maxX - minX, x: minX, y: minY };
}

// Computed from the SAVED graph so the campus is centered on screen.
export function computeCampusCenter(graph: FullGraph): Vector2 {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

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
