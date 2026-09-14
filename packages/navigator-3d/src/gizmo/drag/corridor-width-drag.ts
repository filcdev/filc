// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type {
  CorridorWidthDragState,
  ResizePatch,
} from '../../types/three/gizmo-types';
import { MIN_SIZE } from '../handle-colors';
import { closestPointOnLineToRay } from '../ray-math';
import { SCRATCH } from './scratch';

const MAX_SIZE = 20;

export function startCorridorWidthDrag(
  target: THREE.Object3D,
  handle: THREE.Mesh
): CorridorWidthDragState {
  // Width arrow points along local +Z; rotate into world space through
  // the corridor anchor's matrix so the drag axis follows orientation.
  const localAxis = SCRATCH.v1.set(0, 0, 1);
  SCRATCH.m1.extractRotation(target.matrixWorld);
  const worldAxis = localAxis.applyMatrix4(SCRATCH.m1).normalize().clone();
  const startHandlePos = new THREE.Vector3();
  handle.getWorldPosition(startHandlePos);
  return {
    kind: 'corridor-width',
    startHandlePos,
    startWidth: target.userData.width as number,
    worldAxis,
  };
}

export function applyCorridorWidthDrag(
  drag: CorridorWidthDragState,
  ray: THREE.Ray
): ResizePatch {
  const closest = closestPointOnLineToRay(
    drag.startHandlePos,
    drag.worldAxis,
    ray.origin,
    ray.direction,
    SCRATCH.v3
  );
  const delta = SCRATCH.v2
    .copy(closest)
    .sub(drag.startHandlePos)
    .dot(drag.worldAxis);
  // Symmetric: total width grows by 2 × delta.
  return {
    width: Math.max(MIN_SIZE, Math.min(drag.startWidth + 2 * delta, MAX_SIZE)),
  };
}
