// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import type { Astar } from '../path/astar';
import type { Vec3 } from '../types/three/vector';

const PATH_COLOR = 0xf6_ff_00;
const START_COLOR = 0x55_dd_ff;
const END_COLOR = 0xff_55_77;

// Slimmer than the old overlay (was 0.45). Reads as a guide line, not a pipe.
const TUBE_RADIUS = 1;
// Lifted just above corridor lines (those sit at +0.25 on each storey).
const VERTICAL_LIFT = 0.8;
// Largest corner fillet; always clamped to half of each adjacent segment so
// a sharp/short turn shrinks its own radius instead of overshooting.
const MAX_CORNER_RADIUS = 1.6;
const MARKER_RADIUS = 0.55;

const _q0 = new THREE.Vector3();
const _q1 = new THREE.Vector3();

// Quadratic Bézier a→ctrl→b. The curve is fully contained in the triangle
// (a, ctrl, b), which is what guarantees no overshoot on hairpin turns.
function quadBezier(
  a: THREE.Vector3,
  ctrl: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const u = 1 - t;
  _q0.copy(a).multiplyScalar(u * u);
  _q1.copy(ctrl).multiplyScalar(2 * u * t);
  out
    .copy(b)
    .multiplyScalar(t * t)
    .add(_q0)
    .add(_q1);
  return out;
}

/**
 * Replace each interior corner with a rounded fillet. The fillet radius is
 * clamped to half the shorter neighbouring segment, so even a 170° hairpin
 * or a very short leg produces a clean, contained curve — no Catmull-Rom
 * loops or cusps. Straight runs stay straight.
 */
function roundCorners(
  points: THREE.Vector3[],
  maxRadius: number
): THREE.Vector3[] {
  if (points.length <= 2) {
    return points.map((p) => p.clone());
  }

  const first = points[0];
  const last = points.at(-1);
  if (!(first && last)) {
    return points.map((p) => p.clone());
  }

  const out: THREE.Vector3[] = [first.clone()];
  const inDir = new THREE.Vector3();
  const outDir = new THREE.Vector3();

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    if (!(prev && cur && next)) {
      continue;
    }

    inDir.copy(cur).sub(prev);
    outDir.copy(next).sub(cur);
    const inLen = inDir.length();
    const outLen = outDir.length();
    if (inLen < 1e-5 || outLen < 1e-5) {
      continue;
    }
    inDir.divideScalar(inLen);
    outDir.divideScalar(outLen);

    const r = Math.min(maxRadius, inLen * 0.5, outLen * 0.5);
    const a = cur.clone().addScaledVector(inDir, -r);
    const b = cur.clone().addScaledVector(outDir, r);

    // More samples for sharper turns (one per ~15°).
    const angle = inDir.angleTo(outDir);
    const steps = Math.max(2, Math.min(16, Math.ceil(angle / (Math.PI / 12))));

    out.push(a);
    for (let s = 1; s < steps; s++) {
      out.push(quadBezier(a, cur, b, s / steps, new THREE.Vector3()));
    }
    out.push(b);
  }

  out.push(last.clone());
  return out;
}

function makeMarker(at: THREE.Vector3, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(MARKER_RADIUS, 16, 12),
    new THREE.MeshBasicMaterial({ color, opacity: 0.95, transparent: true })
  );
  mesh.position.copy(at);
  return mesh;
}

/**
 * Build the A* route as a slim, corner-rounded tube with endpoint markers.
 * Own (un-cached) materials so the kiosk's deep-dispose can free it.
 */
export function buildKioskPath(path: Vec3[]): THREE.Group {
  const group = new THREE.Group();
  if (path.length < 2) {
    return group;
  }

  const raw = path.map((p) => new THREE.Vector3(p.x, p.y + VERTICAL_LIFT, p.z));
  const rounded = roundCorners(raw, MAX_CORNER_RADIUS);

  // The points are already smooth, so a centripetal Catmull spline over
  // them only removes faceting — it can't reintroduce overshoot.
  const curve = new THREE.CatmullRomCurve3(rounded, false, 'centripetal', 0.5);
  const tubularSegments = Math.max(32, rounded.length * 3);
  const tube = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    TUBE_RADIUS,
    8,
    false
  );
  group.add(
    new THREE.Mesh(
      tube,
      new THREE.MeshBasicMaterial({
        color: PATH_COLOR,
        opacity: 0.95,
        transparent: true,
      })
    )
  );

  const startPoint = raw[0];
  const endPoint = raw.at(-1);
  if (startPoint && endPoint) {
    group.add(makeMarker(startPoint, START_COLOR));
    group.add(makeMarker(endPoint, END_COLOR));
  }

  return group;
}

function buildKioskDebugPath(path: Vec3[]): THREE.Group {
  const group = new THREE.Group();
  if (path.length < 2) {
    return group;
  }

  const raw = path.map((p) => new THREE.Vector3(p.x, p.y + VERTICAL_LIFT, p.z));
  const rounded = roundCorners(raw, MAX_CORNER_RADIUS);

  // The points are already smooth, so a centripetal Catmull spline over
  // them only removes faceting — it can't reintroduce overshoot.
  const curve = new THREE.CatmullRomCurve3(rounded, false, 'centripetal', 0.5);
  const tubularSegments = Math.max(32, rounded.length * 3);
  const tube = new THREE.TubeGeometry(curve, tubularSegments, 0.1, 8, false);
  group.add(
    new THREE.Mesh(
      tube,
      new THREE.MeshBasicMaterial({
        color: 0xff_ff_ff,
        opacity: 0.95,
        transparent: true,
      })
    )
  );

  const startPoint = raw[0];
  const endPoint = raw.at(-1);
  if (startPoint && endPoint) {
    group.add(makeMarker(startPoint, START_COLOR));
    group.add(makeMarker(endPoint, START_COLOR));
  }

  return group;
}

// function createTextSprite(text: string) {
//     const canvas = document.createElement("canvas")
//     const ctx = canvas.getContext("2d")!

//     const fontSize = 64
//     ctx.font = `${fontSize}px Arial`

//     const padding = 20
//     const textWidth = ctx.measureText(text).width

//     canvas.width = textWidth + padding * 2
//     canvas.height = fontSize + padding * 2

//     ctx.font = `${fontSize}px Arial`

//     ctx.fillStyle = "white"
//     ctx.fillText(text, padding, fontSize)

//     const texture = new THREE.CanvasTexture(canvas)
//     texture.minFilter = THREE.LinearFilter

//     const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
//     const sprite = new THREE.Sprite(material)

//     // scale controls world size of label
//     sprite.scale.set(2, 2, 1)

//     return sprite
// }

export function buildAstarNodes(astar: Astar) {
  const points = astar.getPoints();
  const adj = astar.getAdj();

  const group = new THREE.Group();

  // nodes
  // for (const p of points) {
  /*const label = createTextSprite(String(p[0]))
        label.position.set(p[1].x, p[1].y + 3, p[1].z)
        group.add(label)*/
  // }

  // edges
  for (const [pointId, neighbors] of adj) {
    const startPt = points.get(pointId);
    if (!startPt) {
      continue;
    }

    for (const p of neighbors) {
      const endPt = points.get(p);
      if (endPt) {
        group.add(buildKioskDebugPath([startPt, endPt]));
      }
    }
  }

  return group;
}
