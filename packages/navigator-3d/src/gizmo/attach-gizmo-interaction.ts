// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  DragState,
  HandleSpec,
  ResizePatch,
} from '../types/three/gizmo-types';
import { applyDrag, dragCursor, startDrag } from './drag-dispatch';
import { applyHover, collectHandles } from './handle-hover';
import { updateNdcFromPointer } from './ray-math';

export type GizmoInteractionOpts = {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  controls: OrbitControls;
  getTarget: () => THREE.Object3D | null;
  getOnResize: () => ((p: ResizePatch) => void) | undefined;
  /** Wake the host's render-on-demand loop for hover/drag updates. */
  requestRender?: () => void;
};

// Pointer-down handler: pick a handle, capture drag state, disable orbit.
function pickHandleUnderPointer(
  raycaster: THREE.Raycaster,
  target: THREE.Object3D
): { handle: THREE.Mesh; spec: HandleSpec } | null {
  const handles = collectHandles(target);
  const hits = raycaster.intersectObjects(handles, false);
  const hit = hits[0];
  if (!hit) {
    return null;
  }
  const handle = hit.object as THREE.Mesh;
  const spec = handle.userData.gizmoHandle as HandleSpec;
  return { handle, spec };
}

// Wires pointer events on the canvas to drive the gizmo. Returns a
// cleanup function to remove the listeners.
export function attachGizmoInteraction(opts: GizmoInteractionOpts): () => void {
  const { canvas, camera, controls, getTarget, getOnResize, requestRender } =
    opts;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag: DragState | null = null;

  const onPointerMove = (e: PointerEvent): void => {
    updateNdcFromPointer(e, canvas, ndc);
    raycaster.setFromCamera(ndc, camera);

    if (drag) {
      const patch = applyDrag(drag, raycaster.ray);
      if (patch) {
        getOnResize()?.(patch);
      }
      e.preventDefault();
      return;
    }

    const target = getTarget();
    if (!target) {
      return;
    }
    const hits = raycaster.intersectObjects(collectHandles(target), false);
    applyHover(target, (hits[0]?.object as THREE.Mesh | undefined) ?? null);
    canvas.style.cursor = hits[0] ? 'grab' : '';
    requestRender?.();
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) {
      return;
    }
    const target = getTarget();
    if (!target) {
      return;
    }

    updateNdcFromPointer(e, canvas, ndc);
    raycaster.setFromCamera(ndc, camera);
    const picked = pickHandleUnderPointer(raycaster, target);
    if (!picked) {
      return;
    }

    target.updateMatrixWorld(true);
    const next = startDrag(target, picked.handle, picked.spec, raycaster.ray);
    if (!next) {
      return;
    }
    drag = next;

    controls.enabled = false;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    canvas.style.cursor = dragCursor(picked.spec);
    e.preventDefault();
    e.stopPropagation();
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!drag) {
      return;
    }
    drag = null;
    controls.enabled = true;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    canvas.style.cursor = '';
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  return () => {
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
  };
}
