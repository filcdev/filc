// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type { RotateHandleSpec } from '../../types/three/gizmo-types';
import { ROTATE_COLOR, ROTATE_HOVER_COLOR } from '../handle-colors';

// Flat purple torus in the XZ plane + small dot at local +X marking
// the "0°" heading so the user can see the rotation orientation.
export function makeRotateRing(
  spec: RotateHandleSpec,
  radius: number,
  localY: number
): THREE.Group {
  const group = new THREE.Group();
  const tube = Math.max(0.05, radius * 0.06);

  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 12, 48),
    new THREE.MeshBasicMaterial({
      color: ROTATE_COLOR,
      depthTest: false,
      opacity: 0.9,
      transparent: true,
    })
  );
  torus.rotation.x = Math.PI / 2;
  torus.renderOrder = 998;
  torus.userData.gizmoHandle = spec;
  torus.userData.gizmoGroup = group;
  torus.userData.baseColor = ROTATE_COLOR;
  torus.userData.hoverColor = ROTATE_HOVER_COLOR;
  group.add(torus);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(tube * 1.8, 12, 12),
    new THREE.MeshBasicMaterial({
      color: ROTATE_COLOR,
      depthTest: false,
      opacity: 0.95,
      transparent: true,
    })
  );
  dot.position.set(radius, 0, 0);
  dot.renderOrder = 999;
  dot.userData.gizmoHandle = spec;
  dot.userData.gizmoGroup = group;
  dot.userData.baseColor = ROTATE_COLOR;
  dot.userData.hoverColor = ROTATE_HOVER_COLOR;
  group.add(dot);

  group.position.y = localY;
  return group;
}
