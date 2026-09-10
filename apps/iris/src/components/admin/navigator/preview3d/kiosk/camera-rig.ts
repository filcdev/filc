import type { Object3D, PerspectiveCamera } from 'three';
import { Box3, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { IsolatedFloor, KioskNode } from './types';

const _box = new Box3();
const _center = new Vector3();
const _size = new Vector3();
// Approach direction for the framed shot: high up, slightly back/right.
const _dir = new Vector3(0.35, 1, 0.55).normalize();

export type CameraRig = {
  /** Smoothly is not required — snaps the camera to frame the floor. */
  frameFloor: (floor: IsolatedFloor) => void;
  frameCampus: () => void;
};

/** Reframes the camera to fit a floor or the whole campus while leaving
 *  OrbitControls fully interactive afterwards (the user can still orbit,
 *  pan, zoom). Constraining (no going under the ground) is configured on
 *  the controls by the host. */
export function createCameraRig(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  getRoot: () => Object3D | null,
  getNodes: () => KioskNode[],
  requestRender: () => void
): CameraRig {
  const frameBox = (box: Box3): void => {
    if (box.isEmpty()) {
      return;
    }
    box.getCenter(_center);
    box.getSize(_size);
    const radius = Math.max(_size.x, _size.y, _size.z, 1) * 0.5;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = radius / Math.sin(fov / 2);

    controls.target.copy(_center);
    camera.position.copy(_center).addScaledVector(_dir, dist);
    camera.near = Math.max(0.5, dist / 200);
    camera.far = dist * 50;
    camera.updateProjectionMatrix();
    controls.update();
    requestRender();
  };

  const belongsToFloor = (
    n: KioskNode,
    floor: NonNullable<IsolatedFloor>
  ): boolean => {
    if (n.buildingId !== floor.buildingId) {
      return false;
    }
    if (n.kind === 'lift' || n.kind === 'stairs' || n.kind === 'corridor') {
      return false;
    }
    return n.storey === floor.storey;
  };

  const frameFloor = (floor: IsolatedFloor): void => {
    if (!floor) {
      frameCampus();
      return;
    }
    _box.makeEmpty();
    for (const n of getNodes()) {
      if (!belongsToFloor(n, floor)) {
        continue;
      }
      n.object.updateWorldMatrix(true, true);
      _box.expandByObject(n.object);
    }
    frameBox(_box);
  };

  const frameCampus = (): void => {
    const root = getRoot();
    if (!root) {
      return;
    }
    _box.makeEmpty();
    root.updateWorldMatrix(true, true);
    _box.expandByObject(root);
    frameBox(_box);
  };

  return { frameCampus, frameFloor };
}
