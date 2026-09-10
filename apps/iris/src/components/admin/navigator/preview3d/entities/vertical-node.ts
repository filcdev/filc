import {
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  Group,
  LineSegments,
  Vector3,
} from 'three';
import { ownLineMat, tagApp } from '../kiosk/materials';
import { KIOSK_COLORS, KIOSK_OPACITY } from '../kiosk/palette';
import type { KioskNode } from '../kiosk/types';
import type { Building } from '../types/navigator/building';
import type { Lift } from '../types/navigator/lift';
import type { Stair } from '../types/navigator/stair';
import type { StoreyResolver } from '../types/storey-types';
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
  const group = new Group();

  const wire = new LineSegments(
    new EdgesGeometry(new BoxGeometry(FOOTPRINT, bounds.height, FOOTPRINT)),
    ownLineMat(color, KIOSK_OPACITY.line)
  );
  wire.position.set(cx, bounds.bottom + bounds.height * 0.5, cz);
  tagApp(wire, 'line', color, KIOSK_OPACITY.line);
  group.add(wire);

  const half = FOOTPRINT * 0.5;
  const deckSegs: Vector3[] = [];
  for (let s = lift.min_storey; s <= lift.max_storey; s++) {
    const ys = storeys.bottomY(b.id, s);
    const c0 = new Vector3(cx - half, ys, cz - half);
    const c1 = new Vector3(cx + half, ys, cz - half);
    const c2 = new Vector3(cx + half, ys, cz + half);
    const c3 = new Vector3(cx - half, ys, cz + half);
    deckSegs.push(c0, c1, c1, c2, c2, c3, c3, c0);
    deckSegs.push(c0, c2, c1, c3);
  }
  const decks = new LineSegments(
    new BufferGeometry().setFromPoints(deckSegs),
    ownLineMat(color, KIOSK_OPACITY.deck)
  );
  tagApp(decks, 'deck', color, KIOSK_OPACITY.deck);
  group.add(decks);

  return {
    appearance: [wire, decks],
    buildingId: b.id,
    center: new Vector3(cx, bounds.bottom + bounds.height * 0.5, cz),
    id: lift.id,
    kind: 'lift',
    object: group,
    pickables: [],
    storeyMax: lift.max_storey,
    storeyMin: lift.min_storey,
  };
}

function buildStairLines(profile: StairProfile): Vector3[] {
  const zFront = -STAIR_WIDTH * 0.5;
  const zBack = STAIR_WIDTH * 0.5;
  const points: Vector3[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const cur = profile[i];
    const next = profile[i + 1];
    if (!(cur && next)) {
      continue;
    }
    const [x1, y1] = cur;
    const [x2, y2] = next;
    points.push(
      new Vector3(x1, y1, zFront),
      new Vector3(x2, y2, zFront),
      new Vector3(x1, y1, zBack),
      new Vector3(x2, y2, zBack)
    );
  }
  for (let i = 1; i < profile.length; i += 2) {
    const p = profile[i];
    if (!p) {
      continue;
    }
    const [x, y] = p;
    points.push(new Vector3(x, y, zFront), new Vector3(x, y, zBack));
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
  const group = new Group();
  group.position.set(b.x + s.x, 0, b.y + s.y);
  group.rotation.y = -((s.rotation ?? 0) * Math.PI) / 180;

  const lines = new LineSegments(
    new BufferGeometry().setFromPoints(buildStairLines(profile)),
    ownLineMat(color, KIOSK_OPACITY.line)
  );
  tagApp(lines, 'line', color, KIOSK_OPACITY.line);
  group.add(lines);

  const bottom = storeys.bottomY(b.id, s.min_storey);
  const top = storeys.bottomY(b.id, s.max_storey);

  return {
    appearance: [lines],
    buildingId: b.id,
    center: new Vector3(b.x + s.x, (bottom + top) * 0.5, b.y + s.y),
    id: s.id,
    kind: 'stairs',
    object: group,
    pickables: [],
    storeyMax: s.max_storey,
    storeyMin: s.min_storey,
  };
}
