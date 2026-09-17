import type * as THREE from 'three';

// Per-handle materials are NOT cached, so dispose them when the scene
// is rebuilt. Deduped because arrow shaft + cone share one material.
export function disposeHandleMaterials(root: THREE.Object3D): void {
  const seen = new Set<THREE.Material>();
  root.traverse((obj) => {
    if (!obj.userData?.gizmoHandle) {
      return;
    }
    const mesh = obj as THREE.Mesh;
    const mat = mesh.material as THREE.Material | undefined;
    if (!mat || seen.has(mat)) {
      return;
    }
    seen.add(mat);
    mat.dispose();
  });
}
