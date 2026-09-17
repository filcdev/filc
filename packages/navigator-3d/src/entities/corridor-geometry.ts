import type { Corridor } from '@filcdev/api/domains/navigator/corridor';
// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';

const TICK_SPACING = 3.5;

export type CorridorEndpoints = {
  p1: THREE.Vector2;
  p2: THREE.Vector2;
  dir: THREE.Vector2;
  perp: THREE.Vector2;
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
  const p1 = new THREE.Vector2(buildingX + cor.x1, buildingY + cor.y1);
  const p2 = new THREE.Vector2(buildingX + cor.x2, buildingY + cor.y2);
  const dir = p2.clone().sub(p1);
  const length = dir.length();
  if (length < 0.001) {
    return null;
  }
  const perp = new THREE.Vector2(-dir.y, dir.x)
    .normalize()
    .multiplyScalar(widthM * 0.5);
  return { dir, length, p1, p2, perp };
}

function pushPair(
  out: THREE.Vector3[],
  a: THREE.Vector2,
  b: THREE.Vector2,
  y: number
): void {
  out.push(new THREE.Vector3(a.x, y, a.y), new THREE.Vector3(b.x, y, b.y));
}

export function buildSideRails(
  e: CorridorEndpoints,
  y: number
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  pushPair(out, e.p1, e.p2, y);
  pushPair(out, e.p1.clone().add(e.perp), e.p2.clone().add(e.perp), y);
  pushPair(out, e.p1.clone().sub(e.perp), e.p2.clone().sub(e.perp), y);
  pushPair(out, e.p1.clone().add(e.perp), e.p1.clone().sub(e.perp), y);
  pushPair(out, e.p2.clone().add(e.perp), e.p2.clone().sub(e.perp), y);
  return out;
}

export function buildTickMarks(
  e: CorridorEndpoints,
  y: number
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const tickCount = Math.max(0, Math.floor(e.length / TICK_SPACING) - 1);
  const tickHalf = e.perp.clone().multiplyScalar(0.55);
  for (let i = 1; i <= tickCount; i++) {
    const t = (i * TICK_SPACING) / e.length;
    const at = e.p1.clone().lerp(e.p2, t);
    pushPair(out, at.clone().add(tickHalf), at.clone().sub(tickHalf), y);
  }
  return out;
}
