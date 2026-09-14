// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type {
  CorridorWidthHandleSpec,
  TranslateXYHandleSpec,
} from '../../types/three/gizmo-types';
import type { CorridorHighlightUserData } from '../../types/three/highlight-userdata-types';
import { makeArrowHandle } from './make-arrow-handle';
import { makeTranslatePad } from './make-translate-pad';

function attachEndpointPad(
  target: THREE.Object3D,
  spec: TranslateXYHandleSpec,
  localX: number,
  radius: number
): void {
  const { pad, arrows } = makeTranslatePad(spec, radius);
  pad.position.set(localX, 0.12, 0);
  arrows.position.copy(pad.position);
  target.add(pad);
  target.add(arrows);
}

function attachWidthArrow(target: THREE.Object3D, width: number): void {
  const widthArrowLen = Math.max(1.4, Math.min(width * 0.6, 3.0));
  const spec: CorridorWidthHandleSpec = { kind: 'corridor-width' };
  target.add(
    makeArrowHandle(
      spec,
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0.12, width * 0.5),
      widthArrowLen
    )
  );
}

// Two cyan endpoint pads + one orange width arrow. The wrapping anchor
// is already oriented along the corridor direction, so the pads sit at
// local ±length/2 on +X.
export function attachCorridorHandles(target: THREE.Object3D): void {
  const ud = target.userData as CorridorHighlightUserData;
  const padRadius = Math.max(0.8, Math.min(ud.width * 0.55, 2.0));

  attachEndpointPad(
    target,
    {
      kind: 'translate-xy',
      patchXKey: 'x1',
      patchYKey: 'y1',
      xKey: 'x1',
      yKey: 'y1',
    },
    -ud.length * 0.5,
    padRadius
  );

  attachEndpointPad(
    target,
    {
      kind: 'translate-xy',
      patchXKey: 'x2',
      patchYKey: 'y2',
      xKey: 'x2',
      yKey: 'y2',
    },
    +ud.length * 0.5,
    padRadius
  );

  attachWidthArrow(target, ud.width);
}
