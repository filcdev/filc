import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import type { MyLocation } from '@filcdev/api/domains/navigator/my-location';
// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import { FLOOR_GAP } from '../scene/storey-resolver';
import { FLOOR_HEIGHT } from '../types/three/material-types';
import { floorPositionOf } from './building-helpers';

const MARKER_COLOR = 0xff_2a_2a;

/** Vertical spacing between storeys, matching the storey resolver's stack
 *  (capped room height + the inter-floor gap). Buildings vary slightly,
 *  but with FLOOR_GAP this is a close global approximation for placing a
 *  location marker that isn't tied to a single building. */
export const STOREY_SPACING = FLOOR_HEIGHT + FLOOR_GAP;

/** A camera-facing text label drawn on a canvas sprite. Own texture +
 *  material so the kiosk/editor deep-dispose can free it. */
function makeLabelSprite(text: string): THREE.Sprite {
  const pad = 24;
  const fontSize = 64;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) {
    throw new Error('2D canvas context unavailable');
  }
  measure.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const textW = measure.measureText(text).width;

  const cv = document.createElement('canvas');
  cv.width = Math.ceil(textW + pad * 2);
  cv.height = fontSize + pad * 2;
  const ctx = cv.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }

  // Rounded pill background.
  const r = cv.height / 2;
  ctx.fillStyle = 'rgba(20, 20, 24, 0.82)';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(cv.width, 0, cv.width, cv.height, r);
  ctx.arcTo(cv.width, cv.height, 0, cv.height, r);
  ctx.arcTo(0, cv.height, 0, 0, r);
  ctx.arcTo(0, 0, cv.width, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff5a5a';
  ctx.fillText(text, cv.width / 2, cv.height / 2 + 2);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({
    depthTest: false,
    map: tex,
    transparent: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 1001;
  // Keep the label readable: scale to the canvas aspect, world-height ~6.
  const worldH = 6;
  sprite.scale.set((cv.width / cv.height) * worldH, worldH, 1);
  return sprite;
}

/** Build the "you are here" overlay: a red arrow pointing down at the
 *  spot plus a floating label. Positioned in the campus root-local frame
 *  (same frame entity nodes live in), so it inherits the centering offset
 *  when added under `root`. Not pickable and not tagged for the appearance
 *  layer — it stays red and visible regardless of selection/isolation. */
export function buildLocationMarker(
  graph: FullGraph,
  loc: MyLocation,
  label = 'Itt vagy'
): THREE.Group {
  const group = new THREE.Group();
  const floorY = floorPositionOf(graph, loc.buildingId, loc.storey);

  const mat = new THREE.MeshBasicMaterial({ color: MARKER_COLOR });

  // Arrowhead (cone), apex pointing down toward the floor.
  const head = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3.6, 24), mat);
  head.rotation.x = Math.PI;
  head.position.set(0, floorY + 6.2, 0);
  group.add(head);

  // Shaft above the head.
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 4.5, 16),
    mat
  );
  shaft.position.set(0, floorY + 10.2, 0);
  group.add(shaft);

  const label3d = makeLabelSprite(label);
  label3d.position.set(0, floorY + 15, 0);
  group.add(label3d);

  group.position.set(loc.x, 0, loc.y);
  return group;
}
