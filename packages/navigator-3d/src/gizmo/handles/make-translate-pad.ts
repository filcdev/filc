// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type {
  TranslateHandleSpec,
  TranslateXYHandleSpec,
} from '../../types/three/gizmo-types';
import { TRANSLATE_COLOR } from '../handle-colors';

export type TranslatePadResult = {
  pad: THREE.Mesh;
  arrows: THREE.LineSegments;
};

// Cyan disc + decorative cross-hair. Both meshes returned so the caller
// can place them in the same local frame.
export function makeTranslatePad(
  spec: TranslateHandleSpec | TranslateXYHandleSpec,
  radius: number,
  height = 0.14
): TranslatePadResult {
  const padGeom = new THREE.CylinderGeometry(radius, radius, height, 24);
  const padMat = new THREE.MeshBasicMaterial({
    color: TRANSLATE_COLOR,
    depthTest: false,
    opacity: 0.9,
    transparent: true,
  });
  const pad = new THREE.Mesh(padGeom, padMat);
  pad.renderOrder = 999;
  pad.userData.gizmoHandle = spec;
  pad.userData.baseColor = TRANSLATE_COLOR;

  const aLen = radius * 0.7;
  const arrows = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-aLen, 0, 0),
      new THREE.Vector3(aLen, 0, 0),
      new THREE.Vector3(0, 0, -aLen),
      new THREE.Vector3(0, 0, aLen),
    ]),
    new THREE.LineBasicMaterial({ color: 0xff_ff_ff, depthTest: false })
  );
  arrows.renderOrder = 1000;
  return { arrows, pad };
}
