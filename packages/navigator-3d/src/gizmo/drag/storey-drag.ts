// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type {
  ResizePatch,
  StoreyDragState,
  StoreyHandleSpec,
} from '../../types/three/gizmo-types';
import { FLOOR_HEIGHT } from '../../types/three/material-types';
import { closestPointOnLineToRay } from '../ray-math';
import { SCRATCH } from './scratch';

export function startStoreyDrag(
  target: THREE.Object3D,
  handle: THREE.Mesh,
  spec: StoreyHandleSpec
): StoreyDragState {
  const handleWorldPos = new THREE.Vector3();
  handle.getWorldPosition(handleWorldPos);
  // Anchor on the asset's XZ so horizontal jitter doesn't bleed into Y.
  const anchor = new THREE.Vector3(handleWorldPos.x, 0, handleWorldPos.z);
  return {
    anchor,
    kind: 'storey',
    spec,
    startHandleY: handleWorldPos.y,
    startMaxStorey: target.userData.max_storey as number,
    startMinStorey: target.userData.min_storey as number,
  };
}

export function applyStoreyDrag(
  drag: StoreyDragState,
  ray: THREE.Ray
): ResizePatch {
  const closest = closestPointOnLineToRay(
    drag.anchor,
    SCRATCH.up,
    ray.origin,
    ray.direction,
    SCRATCH.v3
  );
  const dy = closest.y - drag.startHandleY;
  const storeyDelta = Math.round(dy / FLOOR_HEIGHT);
  if (drag.spec.side === +1) {
    return {
      max_storey: Math.max(
        drag.startMinStorey,
        drag.startMaxStorey + storeyDelta
      ),
    };
  }
  return {
    min_storey: Math.min(
      drag.startMaxStorey,
      drag.startMinStorey + storeyDelta
    ),
  };
}
