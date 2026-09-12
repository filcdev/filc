import type * as THREE from 'three';

// Re-sizes the renderer + updates camera aspect on container resize.
// Returns a stop function. The initial resize is performed immediately.
export function observeContainerResize(
  container: HTMLElement,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  requestRender: () => void
): () => void {
  const resize = (): void => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!(w && h)) {
      return;
    }
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  return () => ro.disconnect();
}
