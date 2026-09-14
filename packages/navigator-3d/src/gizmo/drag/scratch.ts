// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';

// Reusable scratch shared across drag handlers — avoids per-frame allocs.
export const SCRATCH = {
  floorPlane: new THREE.Plane(),
  m1: new THREE.Matrix4(),
  up: new THREE.Vector3(0, 1, 0),
  v1: new THREE.Vector3(),
  v2: new THREE.Vector3(),
  v3: new THREE.Vector3(),
};
