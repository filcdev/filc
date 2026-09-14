import type { Building } from '@filcdev/api/domains/navigator/building';
import type { Corridor } from '@filcdev/api/domains/navigator/corridor';
// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import { ownLineMat, tagApp } from '../kiosk/materials';
import { KIOSK_COLORS, KIOSK_OPACITY } from '../kiosk/palette';
import type { KioskNode } from '../kiosk/types';
import type { StoreyResolver } from '../types/three/storey-types';
import {
  buildSideRails,
  buildTickMarks,
  computeCorridorEndpoints,
} from './corridor-geometry';

/** Corridor centerline + rails + ticks + direction chevron. Not pickable
 *  (only floors and classrooms respond to taps). */
export function buildCorridorNode(
  cor: Corridor,
  b: Building,
  storeys: StoreyResolver
): KioskNode | null {
  const widthM = cor.is_outdoor ? Math.max(cor.width, 4) : cor.width;
  const endpoints = computeCorridorEndpoints(cor, b.x, b.y, widthM);
  if (!endpoints) {
    return null;
  }

  const color = cor.is_outdoor ? KIOSK_COLORS.yard : KIOSK_COLORS.corridor;
  const y = storeys.bottomY(b.id, cor.storey) + 0.25;

  const segs: THREE.Vector3[] = [
    ...buildSideRails(endpoints, y),
    ...buildTickMarks(endpoints, y),
  ];
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(segs),
    ownLineMat(color, KIOSK_OPACITY.line)
  );
  tagApp(lines, 'line', color, KIOSK_OPACITY.line);

  const group = new THREE.Group();
  group.add(lines);

  const mid = endpoints.p1.clone().lerp(endpoints.p2, 0.5);

  return {
    appearance: [lines],
    buildingId: b.id,
    center: new THREE.Vector3(mid.x, y, mid.y),
    id: cor.id,
    kind: 'corridor',
    object: group,
    pickables: [],
    storey: cor.storey,
  };
}
