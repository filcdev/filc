import type { Building } from '@filcdev/api/domains/navigator/building';
import type { Lift } from '@filcdev/api/domains/navigator/lift';
import type { Stair } from '@filcdev/api/domains/navigator/stair';
// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import { ownLineMat, tagApp } from '../kiosk/materials';
import { KIOSK_COLORS, KIOSK_OPACITY } from '../kiosk/palette';
import type { KioskNode } from '../kiosk/types';
import type { StoreyResolver } from '../types/three/storey-types';
import { buildStairProfile, type StairProfile } from './stair-profile';
import { computeShaftBounds } from './vertical-asset-common';

const FOOTPRINT = 2.0;
const STAIR_WIDTH = 7;

/** Lift shaft: outline box spanning its storeys + per-deck "stops here"
 *  squares with an X. */
export function buildLiftNode(
  lift: Lift,
  b: Building,
  storeys: StoreyResolver
): KioskNode | null {
  const bounds = computeShaftBounds(
    b.id,
    storeys,
    lift.min_storey,
    lift.max_storey
  );
  if (bounds.height <= 0) {
    return null;
  }

  const color = KIOSK_COLORS.lift;
  const cx = b.x + lift.x;
  const cz = b.y + lift.y;
  const group = new THREE.Group();

  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(FOOTPRINT, bounds.height, FOOTPRINT)
    ),
    ownLineMat(color, KIOSK_OPACITY.line)
  );
  wire.position.set(cx, bounds.bottom + bounds.height * 0.5, cz);
  tagApp(wire, 'line', color, KIOSK_OPACITY.line);
  group.add(wire);

  const half = FOOTPRINT * 0.5;
  const deckSegs: THREE.Vector3[] = [];
  for (let s = lift.min_storey; s <= lift.max_storey; s++) {
    const ys = storeys.bottomY(b.id, s);
    const c0 = new THREE.Vector3(cx - half, ys, cz - half);
    const c1 = new THREE.Vector3(cx + half, ys, cz - half);
    const c2 = new THREE.Vector3(cx + half, ys, cz + half);
    const c3 = new THREE.Vector3(cx - half, ys, cz + half);
    // Outline (c0→c1→c2→c3→c0), then both diagonals.
    deckSegs.push(c0, c1, c1, c2, c2, c3, c3, c0);
    deckSegs.push(c0, c2, c1, c3);
  }
  const decks = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(deckSegs),
    ownLineMat(color, KIOSK_OPACITY.deck)
  );
  tagApp(decks, 'deck', color, KIOSK_OPACITY.deck);
  group.add(decks);

  return {
    appearance: [wire, decks],
    buildingId: b.id,
    center: new THREE.Vector3(cx, bounds.bottom + bounds.height * 0.5, cz),
    id: lift.id,
    kind: 'lift',
    object: group,
    pickables: [],
    storeyMax: lift.max_storey,
    storeyMin: lift.min_storey,
  };
}

function buildStairLines(profile: StairProfile): THREE.Vector3[] {
  const zFront = -STAIR_WIDTH * 0.5;
  const zBack = STAIR_WIDTH * 0.5;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const from = profile[i];
    const to = profile[i + 1];
    if (!(from && to)) {
      continue;
    }
    const [x1, y1] = from;
    const [x2, y2] = to;
    points.push(
      new THREE.Vector3(x1, y1, zFront),
      new THREE.Vector3(x2, y2, zFront)
    );
    points.push(
      new THREE.Vector3(x1, y1, zBack),
      new THREE.Vector3(x2, y2, zBack)
    );
  }
  for (let i = 1; i < profile.length; i += 2) {
    const point = profile[i];
    if (!point) {
      continue;
    }
    const [x, y] = point;
    points.push(
      new THREE.Vector3(x, y, zFront),
      new THREE.Vector3(x, y, zBack)
    );
  }
  return points;
}

/** Stairs: switchback profile drawn as side rails + tread connectors. */
export function buildStairsNode(
  s: Stair,
  b: Building,
  storeys: StoreyResolver
): KioskNode | null {
  if (s.max_storey - s.min_storey <= 0) {
    return null;
  }
  const profile = buildStairProfile(b.id, storeys, s.min_storey, s.max_storey);
  if (profile.length < 2) {
    return null;
  }

  const color = KIOSK_COLORS.stairs;
  const group = new THREE.Group();
  group.position.set(b.x + s.x, 0, b.y + s.y);
  group.rotation.y = -((s.rotation ?? 0) * Math.PI) / 180;

  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(buildStairLines(profile)),
    ownLineMat(color, KIOSK_OPACITY.line)
  );
  tagApp(lines, 'line', color, KIOSK_OPACITY.line);
  group.add(lines);

  const bottom = storeys.bottomY(b.id, s.min_storey);
  const top = storeys.bottomY(b.id, s.max_storey);

  return {
    appearance: [lines],
    buildingId: b.id,
    center: new THREE.Vector3(b.x + s.x, (bottom + top) * 0.5, b.y + s.y),
    id: s.id,
    kind: 'stairs',
    object: group,
    pickables: [],
    storeyMax: s.max_storey,
    storeyMin: s.min_storey,
  };
}
