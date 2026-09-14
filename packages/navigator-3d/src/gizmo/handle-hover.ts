import type * as THREE from 'three';
import { HANDLE_COLOR, HANDLE_HOVER_COLOR } from './handle-colors';

// Collect every Mesh under `target` that carries a gizmoHandle userData tag.
export function collectHandles(target: THREE.Object3D | null): THREE.Mesh[] {
  if (!target) {
    return [];
  }
  const out: THREE.Mesh[] = [];
  target.traverse((obj) => {
    if (obj.userData?.gizmoHandle) {
      out.push(obj as THREE.Mesh);
    }
  });
  return out;
}

// Recolor every handle to reflect the currently-hovered one. Arrows share
// a material across shaft+cone, so we dedupe by material to avoid double
// sets — the whole arrow group highlights together via `gizmoGroup`.
export function applyHover(
  target: THREE.Object3D | null,
  hovered: THREE.Mesh | null
): void {
  const handles = collectHandles(target);
  const hoveredGroup =
    (hovered?.userData?.gizmoGroup as THREE.Object3D | undefined) ?? hovered;
  const seen = new Set<THREE.Material>();
  for (const h of handles) {
    const mat = h.material as THREE.MeshBasicMaterial;
    if (seen.has(mat)) {
      continue;
    }
    seen.add(mat);
    const grp = (h.userData?.gizmoGroup as THREE.Object3D | undefined) ?? h;
    const baseColor =
      (h.userData?.baseColor as number | undefined) ?? HANDLE_COLOR;
    const hoverColor =
      (h.userData?.hoverColor as number | undefined) ?? HANDLE_HOVER_COLOR;
    mat.color.setHex(grp === hoveredGroup ? hoverColor : baseColor);
  }
}
