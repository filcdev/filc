// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type {
  ResizeDragState,
  ResizeHandleSpec,
  ResizePatch,
} from '../../types/three/gizmo-types';
import { FLOOR_HEIGHT } from '../../types/three/material-types';
import { MIN_SIZE } from '../handle-colors';
import { closestPointOnLineToRay } from '../ray-math';
import { SCRATCH } from './scratch';

// Capture the start state of a resize drag — world axis along the
// pressed face, the room's current size on that axis.
export function startResizeDrag(
  target: THREE.Object3D,
  handle: THREE.Mesh,
  spec: ResizeHandleSpec
): ResizeDragState {
  const localAxis = SCRATCH.v1.set(
    spec.axis === 'x' ? spec.side : 0,
    spec.axis === 'y' ? spec.side : 0,
    spec.axis === 'z' ? spec.side : 0
  );
  SCRATCH.m1.extractRotation(target.matrixWorld);
  const worldAxis = localAxis.applyMatrix4(SCRATCH.m1).normalize().clone();
  const startHandlePos = new THREE.Vector3();
  handle.getWorldPosition(startHandlePos);
  let startSize = target.userData.size_z as number;
  if (spec.sizeKey === 'size_x') {
    startSize = target.userData.size_x as number;
  } else if (spec.sizeKey === 'size_y') {
    startSize = target.userData.size_y as number;
  }
  return { kind: 'resize', spec, startHandlePos, startSize, worldAxis };
}

// Compute new size from cursor's projection onto the constrained axis.
export function applyResizeDrag(
  drag: ResizeDragState,
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
  // Symmetric handles double the delta — both faces move, so the
  // dragged face stays under the cursor.
  const factor = drag.spec.mode === 'symmetric' ? 2 : 1;
  let newSize = Math.max(
    MIN_SIZE,
    drag.startSize + factor * delta * drag.spec.side
  );
  if (drag.spec.sizeKey === 'size_z') {
    newSize = Math.min(newSize, FLOOR_HEIGHT);
  }
  return { [drag.spec.sizeKey]: newSize } as ResizePatch;
}
