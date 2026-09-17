import type { Building } from '@filcdev/api/domains/navigator/building';
import type { Corridor } from '@filcdev/api/domains/navigator/corridor';
import { Vec2 } from '../types/three/vector';

function getCorners(cor: Corridor, building?: Building): Vec2[] {
  const start = new Vec2(
    cor.x1 + (building ? building.x : 0),
    cor.y1 + (building ? building.y : 0)
  );
  const end = new Vec2(
    cor.x2 + (building ? building.x : 0),
    cor.y2 + (building ? building.y : 0)
  );

  const dir = end.sub(start).normalize();
  const perp = dir.perp();

  const offset = perp.mul((cor.width + 1) / 2);

  const a = start.add(offset);
  const b = start.sub(offset);
  const c = end.sub(offset);
  const d = end.add(offset);

  return [a, b, c, d];
}

function project(points: Vec2[], axis: Vec2): { min: number; max: number } {
  const first = points[0];
  if (!first) {
    return { max: 0, min: 0 };
  }

  let min = first.dot(axis);
  let max = min;

  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (!point) {
      continue;
    }
    const p = point.dot(axis);
    if (p < min) {
      min = p;
    }
    if (p > max) {
      max = p;
    }
  }

  return { max, min };
}

function overlaps(
  a: { min: number; max: number },
  b: { min: number; max: number }
) {
  return !(a.max < b.min || b.max < a.min);
}

function getAxes(corners: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];

  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % corners.length];
    if (!(p1 && p2)) {
      continue;
    }

    const edge = p2.sub(p1);
    const normal = edge.perp().normalize();

    axes.push(normal);
  }

  return axes;
}

export function corridorsIntersect(
  a: Corridor,
  b: Corridor,
  buildings: Building[]
): boolean {
  const aCorners = getCorners(
    a,
    buildings.find((x) => x.id === a.building_id)
  );
  const bCorners = getCorners(
    b,
    buildings.find((x) => x.id === b.building_id)
  );

  const axes = [...getAxes(aCorners), ...getAxes(bCorners)];

  for (const axis of axes) {
    const projA = project(aCorners, axis);
    const projB = project(bCorners, axis);

    if (!overlaps(projA, projB)) {
      return false; // separating axis found
    }
  }

  return true; // no separating axis → collision
}
