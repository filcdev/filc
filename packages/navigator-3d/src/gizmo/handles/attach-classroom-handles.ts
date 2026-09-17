// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type {
  ResizeHandleSpec,
  TranslateHandleSpec,
} from '../../types/three/gizmo-types';
import type { ClassroomHighlightUserData } from '../../types/three/highlight-userdata-types';
import { makeArrowHandle } from './make-arrow-handle';
import { makeRotateRing } from './make-rotate-ring';
import { makeTranslatePad } from './make-translate-pad';

const RESIZE_SPECS: ResizeHandleSpec[] = [
  { axis: 'x', kind: 'resize', mode: 'symmetric', side: +1, sizeKey: 'size_x' },
  { axis: 'y', kind: 'resize', mode: 'anchored', side: +1, sizeKey: 'size_z' },
  { axis: 'z', kind: 'resize', mode: 'anchored', side: +1, sizeKey: 'size_y' },
];

const TRANSLATE_SPEC: TranslateHandleSpec = { kind: 'translate' };

function attachTranslatePad(
  target: THREE.Object3D,
  half: { x: number; y: number; z: number }
): void {
  const padRadius = Math.min(half.x, half.z) * 0.5;
  const { pad, arrows } = makeTranslatePad(TRANSLATE_SPEC, padRadius, 0.12);
  pad.position.set(0, -half.y, 0);
  arrows.position.copy(pad.position);
  target.add(pad);
  target.add(arrows);
}

function attachResizeArrows(
  target: THREE.Object3D,
  half: { x: number; y: number; z: number },
  arrowLen: number
): void {
  for (const spec of RESIZE_SPECS) {
    const dir = new THREE.Vector3(
      spec.axis === 'x' ? spec.side : 0,
      spec.axis === 'y' ? spec.side : 0,
      spec.axis === 'z' ? spec.side : 0
    );
    const origin = new THREE.Vector3(
      spec.axis === 'x' ? half.x * spec.side : 0,
      spec.axis === 'y' ? half.y * spec.side : 0,
      spec.axis === 'z' ? half.z * spec.side : 0
    );
    target.add(makeArrowHandle(spec, dir, origin, arrowLen));
  }
}

function attachRotateRing(
  target: THREE.Object3D,
  half: { x: number; y: number; z: number }
): void {
  const radius = Math.max(half.x, half.z) + 0.6;
  target.add(
    makeRotateRing(
      { kind: 'rotate', patchKey: 'rotation' },
      radius,
      -half.y + 0.05
    )
  );
}

// Adds resize arrows, a cyan translate pad, and a purple rotation ring.
// All children live in the room's local frame so they inherit the door
// rotation automatically.
export function attachClassroomHandles(target: THREE.Object3D): void {
  const ud = target.userData as ClassroomHighlightUserData;
  const half = { x: ud.size_x * 0.5, y: ud.boxH * 0.5, z: ud.size_y * 0.5 };
  const arrowLen = Math.min(
    Math.max(Math.min(ud.size_x, ud.size_y) * 0.45, 1.6),
    3.5
  );

  attachRotateRing(target, half);
  attachTranslatePad(target, half);
  attachResizeArrows(target, half, arrowLen);
}
