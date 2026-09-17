import type * as THREE from 'three';
import type {
  DragState,
  HandleSpec,
  ResizePatch,
} from '../types/three/gizmo-types';
import {
  applyCorridorWidthDrag,
  startCorridorWidthDrag,
} from './drag/corridor-width-drag';
import { applyResizeDrag, startResizeDrag } from './drag/resize-drag';
import { applyRotateDrag, startRotateDrag } from './drag/rotate-drag';
import { applyStoreyDrag, startStoreyDrag } from './drag/storey-drag';
import { applyTranslateDrag, startTranslateDrag } from './drag/translate-drag';
import {
  applyTranslateXYDrag,
  startTranslateXYDrag,
} from './drag/translate-xy-drag';

// Build a drag state from the handle that was just pressed.
export function startDrag(
  target: THREE.Object3D,
  handle: THREE.Mesh,
  spec: HandleSpec,
  ray: THREE.Ray
): DragState | null {
  switch (spec.kind) {
    case 'resize':
      return startResizeDrag(target, handle, spec);
    case 'translate':
      return startTranslateDrag(target, handle, ray);
    case 'translate-xy':
      return startTranslateXYDrag(target, handle, spec, ray);
    case 'storey':
      return startStoreyDrag(target, handle, spec);
    case 'rotate':
      return startRotateDrag(target, handle, spec, ray);
    case 'corridor-width':
      return startCorridorWidthDrag(target, handle);
    default:
      return null;
  }
}

// Compute a patch from a live drag against the current pointer ray.
// Returns null when the cursor missed the constraint surface this frame.
export function applyDrag(drag: DragState, ray: THREE.Ray): ResizePatch | null {
  switch (drag.kind) {
    case 'resize':
      return applyResizeDrag(drag, ray);
    case 'translate':
      return applyTranslateDrag(drag, ray);
    case 'translate-xy':
      return applyTranslateXYDrag(drag, ray);
    case 'storey':
      return applyStoreyDrag(drag, ray);
    case 'rotate':
      return applyRotateDrag(drag, ray);
    case 'corridor-width':
      return applyCorridorWidthDrag(drag, ray);
    default:
      return null;
  }
}

// Cursor hint while a drag is active. Translates use "move", everything
// else "grabbing" — matches Paint-style cursor expectations.
export function dragCursor(spec: HandleSpec): string {
  if (spec.kind === 'translate' || spec.kind === 'translate-xy') {
    return 'move';
  }
  return 'grabbing';
}
