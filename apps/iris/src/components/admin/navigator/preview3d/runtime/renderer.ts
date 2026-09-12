import {
  AmbientLight,
  Color,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { COLORS } from '../types/color-types';

// Create the WebGLRenderer, attach to the container, set sane defaults.
export function createRenderer(container: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    antialias: true,
    powerPreference: 'low-power',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(COLORS.bg);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);
  return renderer;
}

export function createScene(): Scene {
  const scene = new Scene();
  scene.background = new Color(COLORS.bg);
  scene.add(new AmbientLight(0xff_ff_ff, 0.5));
  return scene;
}

export function createCamera(initialDistance: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.5, 4000);
  camera.position.set(
    initialDistance * 0.7,
    initialDistance * 0.7,
    initialDistance * 0.7
  );
  return camera;
}
