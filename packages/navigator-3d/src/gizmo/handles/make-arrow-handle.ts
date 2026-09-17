// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type { HandleSpec } from '../../types/three/gizmo-types';
import { HANDLE_COLOR } from '../handle-colors';

// Cylinder shaft + cone head as one Group. Shared material lets hover
// recolor the whole arrow with a single mutation. `depthTest: false` plus
// a high `renderOrder` keeps the arrow grabbable through walls.
export function makeArrowHandle(
  spec: HandleSpec,
  dir: THREE.Vector3,
  origin: THREE.Vector3,
  length: number
): THREE.Group {
  const headLen = length * 0.4;
  const headRadius = length * 0.18;
  const shaftLen = Math.max(0.05, length - headLen);
  const shaftRadius = headRadius * 0.35;

  const mat = new THREE.MeshBasicMaterial({
    color: HANDLE_COLOR,
    depthTest: false,
    opacity: 0.95,
    transparent: true,
  });

  const group = new THREE.Group();

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLen, 14),
    mat
  );
  shaft.position.y = shaftLen / 2;
  shaft.renderOrder = 999;
  shaft.userData.gizmoHandle = spec;
  shaft.userData.gizmoGroup = group;
  shaft.userData.baseColor = HANDLE_COLOR;
  group.add(shaft);

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(headRadius, headLen, 18),
    mat
  );
  head.position.y = shaftLen + headLen / 2;
  head.renderOrder = 999;
  head.userData.gizmoHandle = spec;
  head.userData.gizmoGroup = group;
  head.userData.baseColor = HANDLE_COLOR;
  group.add(head);

  group.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
  group.position.copy(origin);
  return group;
}
