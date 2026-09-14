// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type {
  ResizePatch,
  TranslateDragState,
} from '../../types/three/gizmo-types';
import { SCRATCH } from './scratch';

// Classroom-style translate: drag is constrained to the floor plane at
// the handle's world Y. Returns null if the start ray misses the plane.
export function startTranslateDrag(
  target: THREE.Object3D,
  handle: THREE.Mesh,
  ray: THREE.Ray
): TranslateDragState | null {
  const handleWorldPos = new THREE.Vector3();
  handle.getWorldPosition(handleWorldPos);
  const floorY = handleWorldPos.y;
  SCRATCH.floorPlane.set(SCRATCH.up, -floorY);
  const hit = new THREE.Vector3();
  if (!ray.intersectPlane(SCRATCH.floorPlane, hit)) {
    return null;
  }
  return {
    floorY,
    kind: 'translate',
    startDoorX: target.userData.x as number,
    startDoorY: target.userData.y as number,
    startWorldHit: hit,
  };
}

export function applyTranslateDrag(
  drag: TranslateDragState,
  ray: THREE.Ray
): ResizePatch | null {
  SCRATCH.floorPlane.set(SCRATCH.up, -drag.floorY);
  if (!ray.intersectPlane(SCRATCH.floorPlane, SCRATCH.v3)) {
    return null;
  }
  const dx = SCRATCH.v3.x - drag.startWorldHit.x;
  const dz = SCRATCH.v3.z - drag.startWorldHit.z;
  return { x: drag.startDoorX + dx, y: drag.startDoorY + dz };
}
