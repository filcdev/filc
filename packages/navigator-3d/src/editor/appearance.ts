import type * as THREE from 'three';
import type { AppData } from '../kiosk/materials';
import { KIOSK_COLORS } from '../kiosk/palette';
import type { KioskNode, KioskNodeKind } from '../kiosk/types';
import type { EditorAppearance, EditorFilter } from './types';

/** How a single node reads against the current state. */
type Emphasis = 'highlight' | 'dim' | 'base';

function paint(
  mesh: THREE.Object3D,
  color: THREE.ColorRepresentation,
  opacity: number
): void {
  const mat = (mesh as THREE.Mesh).material as
    | THREE.MeshBasicMaterial
    | THREE.LineBasicMaterial
    | undefined;
  if (!mat) {
    return;
  }
  mat.color.set(color);
  mat.opacity = opacity;
  mat.transparent = opacity < 1;
  mat.depthWrite = !mat.transparent;
}

function has(arr: string[] | number[] | null | undefined): boolean {
  return !!arr && arr.length > 0;
}

/** Whether a node survives the visibility filter. Each axis restricts
 *  only when populated; lift/stairs match a storey if their span covers it. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported filter logic, kept verbatim
function passesFilter(
  node: KioskNode,
  filter: EditorFilter | undefined
): boolean {
  if (!filter) {
    return true;
  }

  if (filter.buildingIds && !filter.buildingIds.includes(node.buildingId)) {
    return false;
  }

  if (filter.storeys && has(filter.storeys)) {
    const storeys = filter.storeys as number[];
    if (node.kind === 'lift' || node.kind === 'stairs') {
      const lo = node.storeyMin ?? 0;
      const hi = node.storeyMax ?? 0;
      if (!storeys.some((s) => s >= lo && s <= hi)) {
        return false;
      }
    } else if (node.storey === undefined || !storeys.includes(node.storey)) {
      return false;
    }
  }

  // Type filter only hides non-matching classrooms; structure stays.
  if (
    has(filter.typeIds) &&
    node.kind === 'classroom' &&
    !(node.typeId && filter.typeIds?.includes(node.typeId))
  ) {
    return false;
  }

  return true;
}

function emphasisOf(node: KioskNode, app: EditorAppearance): Emphasis {
  const emph = app.emphasis;
  if (!emph) {
    return 'base';
  }

  if (!emph.kind) {
    return 'base';
  }

  if (
    emph.kind === 'building' &&
    emph.highlightIds?.includes(node.buildingId)
  ) {
    return 'highlight';
  }

  if (node.kind === emph.kind && emph.highlightIds?.includes(node.id)) {
    return 'highlight';
  }

  return emph.dimOthers ? 'dim' : 'base';
}

/** Repaint one mesh from its stored base look, so "base"/"dim" always
 *  restore cleanly. Mirrors the kiosk appearance pass. */
function applyMesh(
  mesh: THREE.Object3D,
  emphasis: Emphasis,
  kind: KioskNodeKind
): void {
  const data = mesh.userData.app as AppData | undefined;
  if (!data) {
    return;
  }

  if (emphasis === 'base') {
    paint(mesh, data.baseColor, data.baseOpacity);
    return;
  }
  if (emphasis === 'dim') {
    paint(
      mesh,
      data.baseColor,
      data.baseOpacity * (kind === 'classroom' ? 0.1 : 1)
    );
    return;
  }

  // Accent: door outline stays white for contrast; everything else takes
  // the highlight color at a boosted, role-appropriate opacity.
  if (data.role === 'doorLine') {
    paint(mesh, data.baseColor, 1);
    return;
  }
  let opacity = Math.max(data.baseOpacity, 0.9);
  if (data.role === 'fill') {
    opacity = Math.max(data.baseOpacity, 0.85);
  } else if (data.role === 'line') {
    opacity = 1;
  }
  paint(mesh, KIOSK_COLORS.highlight, opacity);
}

/** Apply visibility + colors for the whole scene in place. No geometry is
 *  created or destroyed — the cheap per-state pass for the editor. */
export function applyEditorAppearance(
  nodes: KioskNode[],
  app: EditorAppearance
): void {
  for (const node of nodes) {
    node.object.visible = passesFilter(node, app.filter);
    const emphasis = emphasisOf(node, app);
    for (const mesh of node.appearance) {
      applyMesh(mesh, emphasis, node.kind);
    }
  }
}

/** Force one node's whole appearance to the accent look. Used for the live
 *  preview node of the entity being edited (it lives outside `nodes`). */
export function accentNode(node: KioskNode): void {
  for (const mesh of node.appearance) {
    applyMesh(mesh, 'highlight', node.kind);
  }
}
