// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import { AXES, type Axis } from '../types/three/axis-types';

const SCRATCH_V = new THREE.Vector3();
const SCRATCH_Q = new THREE.Quaternion();

export type ProjectedAxis = {
  index: number;
  screenX: number;
  screenY: number;
  depth: number;
};

// Project every axis tip through the camera's inverse rotation, returning
// screen-space offsets in [-RADIUS, +RADIUS] suitable for SVG placement.
export function projectAxes(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  radius: number
): ProjectedAxis[] {
  // Force camera.quaternion to reflect looking at target — OrbitControls
  // may not have updated yet on first paint, leaving identity rotation.
  camera.lookAt(target);
  SCRATCH_Q.copy(camera.quaternion).invert();
  return AXES.map((axis, index) => {
    SCRATCH_V.set(...axis.dir).applyQuaternion(SCRATCH_Q);
    return {
      // Camera looks down -Z; positive z = behind the camera.
      depth: -SCRATCH_V.z,
      index,
      screenX: SCRATCH_V.x * radius,
      screenY: -SCRATCH_V.y * radius,
    };
  });
}

// Snap the camera so the given axis direction points toward the viewer.
// Preserves orbit distance so zoom level stays consistent across snaps.
export function snapCameraToAxis(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  dir: Axis['dir']
): void {
  const dist = camera.position.clone().sub(target).length() || 80;
  camera.rotation.set(0, -dir[1], 0);
  camera.position.set(
    target.x + dir[0] * dist,
    target.y + dir[1] * dist,
    target.z + dir[2] * dist
  );
  camera.lookAt(target);
}
