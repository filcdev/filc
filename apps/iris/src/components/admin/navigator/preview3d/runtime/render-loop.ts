import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type RenderLoop = {
  requestRender: () => void;
  stop: () => void;
};

// Render-on-demand: only draws when the scene is marked dirty OR while
// the camera is in motion (controls.update returns true). Saves GPU
// when the user isn't interacting.
export function createRenderLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  controls: OrbitControls
): RenderLoop {
  let raf = 0;
  let dirty = true;

  const render = (): void => {
    const moved = controls.update();
    if (moved || dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
    raf = moved ? requestAnimationFrame(render) : 0;
  };

  const requestRender = (): void => {
    dirty = true;
    if (!raf) {
      raf = requestAnimationFrame(render);
    }
  };

  const stop = (): void => {
    if (raf) {
      cancelAnimationFrame(raf);
    }
    raf = 0;
  };

  return { requestRender, stop };
}
