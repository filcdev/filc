// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';

// Closest point on line P + t·dir to the ray O + s·rayDir.
// Used to project a 2D mouse onto a constrained 1D resize axis.
export function closestPointOnLineToRay(
  linePoint: THREE.Vector3,
  lineDir: THREE.Vector3,
  rayOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  out: THREE.Vector3
): THREE.Vector3 {
  const v = _v.copy(linePoint).sub(rayOrigin);
  const b = lineDir.dot(rayDir);
  const d = lineDir.dot(v);
  const e = rayDir.dot(v);
  const denom = 1 - b * b;
  if (Math.abs(denom) < 1e-6) {
    return out.copy(linePoint);
  }
  const t = (e * b - d) / denom;
  return out.copy(linePoint).addScaledVector(lineDir, t);
}

// Update raycaster NDC from a pointer event on a canvas.
export function updateNdcFromPointer(
  e: PointerEvent,
  canvas: HTMLCanvasElement,
  out: THREE.Vector2
): void {
  const rect = canvas.getBoundingClientRect();
  out.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  out.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

// Reusable scratch — Three.js math is allocation-heavy if you `new` per frame.
const _v = new THREE.Vector3();
