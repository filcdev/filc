// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type {
  ResizePatch,
  RotateDragState,
  RotateHandleSpec,
} from '../../types/three/gizmo-types';
import { SCRATCH } from './scratch';

export function startRotateDrag(
  target: THREE.Object3D,
  handle: THREE.Mesh,
  spec: RotateHandleSpec,
  ray: THREE.Ray
): RotateDragState | null {
  const handleWorldPos = new THREE.Vector3();
  handle.getWorldPosition(handleWorldPos);
  const floorY = handleWorldPos.y;
  SCRATCH.floorPlane.set(SCRATCH.up, -floorY);
  const hit = new THREE.Vector3();
  if (!ray.intersectPlane(SCRATCH.floorPlane, hit)) {
    return null;
  }
  const center = new THREE.Vector3();
  target.getWorldPosition(center);
  return {
    centerXZ: new THREE.Vector2(center.x, center.z),
    floorY,
    kind: 'rotate',
    spec,
    startCursorAngle: Math.atan2(hit.z - center.z, hit.x - center.x),
    startRotationDeg:
      (target.userData[spec.patchKey] as number | undefined) ?? 0,
  };
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function applyRotateDrag(
  drag: RotateDragState,
  ray: THREE.Ray
): ResizePatch | null {
  SCRATCH.floorPlane.set(SCRATCH.up, -drag.floorY);
  if (!ray.intersectPlane(SCRATCH.floorPlane, SCRATCH.v3)) {
    return null;
  }
  const angle = Math.atan2(
    SCRATCH.v3.z - drag.centerXZ.y,
    SCRATCH.v3.x - drag.centerXZ.x
  );
  const deltaDeg = ((angle - drag.startCursorAngle) * 180) / Math.PI;
  const next = normalizeAngle(drag.startRotationDeg + deltaDeg);
  return { [drag.spec.patchKey]: next } as ResizePatch;
}
