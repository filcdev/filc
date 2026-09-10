import { Vector2, Vector3 } from 'three';
import type { Corridor } from '../types/navigator/corridor';

const TICK_SPACING = 3.5;

export type CorridorEndpoints = {
  p1: Vector2;
  p2: Vector2;
  dir: Vector2;
  perp: Vector2;
  length: number;
};

// World-space endpoints + direction/perpendicular vectors for a corridor.
// Returns null when length is degenerate (would produce NaN perp).
export function computeCorridorEndpoints(
  cor: Corridor,
  buildingX: number,
  buildingY: number,
  widthM: number
): CorridorEndpoints | null {
  const p1 = new Vector2(buildingX + cor.x1, buildingY + cor.y1);
  const p2 = new Vector2(buildingX + cor.x2, buildingY + cor.y2);
  const dir = p2.clone().sub(p1);
  const length = dir.length();
  if (length < 0.001) {
    return null;
  }
  const perp = new Vector2(-dir.y, dir.x)
    .normalize()
    .multiplyScalar(widthM * 0.5);
  return { dir, length, p1, p2, perp };
}

function pushPair(out: Vector3[], a: Vector2, b: Vector2, y: number): void {
  out.push(new Vector3(a.x, y, a.y), new Vector3(b.x, y, b.y));
}

export function buildSideRails(e: CorridorEndpoints, y: number): Vector3[] {
  const out: Vector3[] = [];
  pushPair(out, e.p1, e.p2, y);
  pushPair(out, e.p1.clone().add(e.perp), e.p2.clone().add(e.perp), y);
  pushPair(out, e.p1.clone().sub(e.perp), e.p2.clone().sub(e.perp), y);
  pushPair(out, e.p1.clone().add(e.perp), e.p1.clone().sub(e.perp), y);
  pushPair(out, e.p2.clone().add(e.perp), e.p2.clone().sub(e.perp), y);
  return out;
}

export function buildTickMarks(e: CorridorEndpoints, y: number): Vector3[] {
  const out: Vector3[] = [];
  const tickCount = Math.max(0, Math.floor(e.length / TICK_SPACING) - 1);
  const tickHalf = e.perp.clone().multiplyScalar(0.55);
  for (let i = 1; i <= tickCount; i++) {
    const t = (i * TICK_SPACING) / e.length;
    const at = e.p1.clone().lerp(e.p2, t);
    pushPair(out, at.clone().add(tickHalf), at.clone().sub(tickHalf), y);
  }
  return out;
}
