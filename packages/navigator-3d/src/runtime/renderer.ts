// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import { COLORS } from '../types/three/color-types';

// Create the WebGLRenderer, attach to the container, set sane defaults.
export function createRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
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

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  scene.add(new THREE.AmbientLight(0xff_ff_ff, 0.5));
  return scene;
}

export function createCamera(initialDistance: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
  camera.position.set(
    initialDistance * 0.7,
    initialDistance * 0.7,
    initialDistance * 0.7
  );
  return camera;
}
