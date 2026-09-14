// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type {
  StoreyHandleSpec,
  TranslateXYHandleSpec,
} from '../../types/three/gizmo-types';
import type {
  LiftHighlightUserData,
  StairsHighlightUserData,
} from '../../types/three/highlight-userdata-types';
import { makeArrowHandle } from './make-arrow-handle';
import { makeRotateRing } from './make-rotate-ring';
import { makeTranslatePad } from './make-translate-pad';

const TRANSLATE_SPEC: TranslateXYHandleSpec = {
  kind: 'translate-xy',
  patchXKey: 'x',
  patchYKey: 'y',
  xKey: 'x',
  yKey: 'y',
};

function attachStoreyArrow(
  target: THREE.Object3D,
  side: 1 | -1,
  y: number
): void {
  const spec: StoreyHandleSpec = { kind: 'storey', side };
  target.add(
    makeArrowHandle(
      spec,
      new THREE.Vector3(0, side, 0),
      new THREE.Vector3(0, y, 0),
      3.5
    )
  );
}

function attachAnchorPad(target: THREE.Object3D, bottomY: number): void {
  const { pad, arrows } = makeTranslatePad(TRANSLATE_SPEC, 2.2);
  pad.position.set(0, bottomY + 0.1, 0);
  arrows.position.copy(pad.position);
  target.add(pad);
  target.add(arrows);
}

export function attachLiftHandles(target: THREE.Object3D): void {
  const ud = target.userData as LiftHighlightUserData;
  attachAnchorPad(target, ud.bottom_y);
  attachStoreyArrow(target, +1, ud.top_y);
  attachStoreyArrow(target, -1, ud.bottom_y);
}

export function attachStairsHandles(target: THREE.Object3D): void {
  const ud = target.userData as StairsHighlightUserData;
  attachAnchorPad(target, ud.bottom_y);
  attachStoreyArrow(target, +1, ud.top_y);
  attachStoreyArrow(target, -1, ud.bottom_y);
  target.add(
    makeRotateRing(
      { kind: 'rotate', patchKey: 'rotation' },
      3.4,
      ud.bottom_y + 0.2
    )
  );
}
