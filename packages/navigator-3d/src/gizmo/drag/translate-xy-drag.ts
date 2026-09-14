// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type {
  ResizePatch,
  TranslateXYDragState,
  TranslateXYHandleSpec,
} from '../../types/three/gizmo-types';
import { SCRATCH } from './scratch';

// Floor-plane translate that pulls start values from arbitrary userData
// keys named by the spec. Drives building (x,y), lift/stairs (x,y), and
// corridor endpoints (x1/y1, x2/y2).
export function startTranslateXYDrag(
  target: THREE.Object3D,
  handle: THREE.Mesh,
  spec: TranslateXYHandleSpec,
  ray: THREE.Ray
): TranslateXYDragState | null {
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
    kind: 'translate-xy',
    spec,
    startWorldHit: hit,
    startX: target.userData[spec.xKey] as number,
    startY: target.userData[spec.yKey] as number,
  };
}

export function applyTranslateXYDrag(
  drag: TranslateXYDragState,
  ray: THREE.Ray
): ResizePatch | null {
  SCRATCH.floorPlane.set(SCRATCH.up, -drag.floorY);
  if (!ray.intersectPlane(SCRATCH.floorPlane, SCRATCH.v3)) {
    return null;
  }
  const dx = SCRATCH.v3.x - drag.startWorldHit.x;
  const dz = SCRATCH.v3.z - drag.startWorldHit.z;
  const patch: Record<string, number> = {};
  patch[drag.spec.patchXKey] = drag.startX + dx;
  patch[drag.spec.patchYKey] = drag.startY + dz;
  return patch as ResizePatch;
}
