import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import type { MyLocation } from '@filcdev/api/domains/navigator/my-location';
// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import { buildKioskCampus } from '../entities/build-kiosk-campus';
import { floorPositionOf } from '../entities/building-helpers';
import { buildLocationMarker } from '../entities/location-marker';
import { disposeHandleMaterials } from '../gizmo/dispose-handle-materials';
import { attachBuildingHandles } from '../gizmo/handles/attach-building-handles';
import { attachClassroomHandles } from '../gizmo/handles/attach-classroom-handles';
import { attachCorridorHandles } from '../gizmo/handles/attach-corridor-handles';
import {
  attachLiftHandles,
  attachStairsHandles,
} from '../gizmo/handles/attach-vertical-asset-handles';
import { makeTranslatePad } from '../gizmo/handles/make-translate-pad';
import { disposeDeep } from '../kiosk/materials';
import type { KioskNode } from '../kiosk/types';
import { buildStoreyResolver } from '../scene/storey-resolver';
import type { StoreyResolver } from '../types/three/storey-types';
import { buildEditAnchor } from './anchors';
import { accentNode, applyEditorAppearance } from './appearance';
import { mergeEntity } from './merge';
import { buildPreviewNode } from './preview-node';
import type { EditKind, EditorAppearance, EditTarget } from './types';

/** Owns the campus geometry for the editor. Geometry is built once per
 *  graph; appearance (filter/highlight/dim) is a cheap in-place pass; the
 *  single entity being edited gets a live preview node + an invisible
 *  gizmo anchor — neither touches the rest of the campus. */
export type EditorSceneController = {
  setGraph: (graph: FullGraph | null) => void;
  applyAppearance: (app: EditorAppearance) => void;
  /** Show/clear the gizmo + live preview for one entity. */
  setEdit: (target: EditTarget | null) => void;
  /** Show/clear the draggable "my location" marker. When set (and no
   *  entity is being edited) the marker's translate handle becomes the
   *  active gizmo target. */
  setMyLocation: (loc: MyLocation | null) => void;
  /** The current gizmo anchor (handle-bearing Object3D), or null. */
  getGizmoTarget: () => THREE.Object3D | null;
  dispose: () => void;
};

/** An invisible anchor carrying a translate pad in the floor plane, used
 *  to drag the location marker exactly like a classroom. `userData.x/y`
 *  feed the translate drag; the emitted patch carries the new x/y. */
function buildLocationAnchor(
  graph: FullGraph,
  loc: MyLocation
): THREE.Object3D {
  const anchor = new THREE.Group();
  anchor.position.set(
    loc.x,
    floorPositionOf(graph, loc.buildingId, loc.storey),
    loc.y
  );
  anchor.userData = { x: loc.x, y: loc.y };
  const { pad, arrows } = makeTranslatePad({ kind: 'translate' }, 2.5, 0.2);
  anchor.add(pad);
  anchor.add(arrows);
  return anchor;
}

function attachHandles(anchor: THREE.Object3D, kind: EditKind): void {
  switch (kind) {
    case 'classroom':
      attachClassroomHandles(anchor);
      return;
    case 'building':
      attachBuildingHandles(anchor);
      return;
    case 'corridor':
      attachCorridorHandles(anchor);
      return;
    case 'lift':
      attachLiftHandles(anchor);
      return;
    case 'stairs':
      attachStairsHandles(anchor);
      return;
    default:
      break;
  }
}

export function createEditorScene(scene: THREE.Scene): EditorSceneController {
  let root: THREE.Group | null = null;
  let nodes: KioskNode[] = [];
  let nodesByKey = new Map<string, KioskNode>();
  let graphRef: FullGraph | null = null;
  let storeys: StoreyResolver | null = null;

  // Live-edit state.
  let previewNode: KioskNode | null = null;
  let anchor: THREE.Object3D | null = null;
  let hiddenOriginal: KioskNode | null = null;
  // Building moves are previewed by translating its existing nodes.
  let buildingShift: { dx: number; dz: number; moved: KioskNode[] } | null =
    null;

  // "My location" marker state (decoupled from entity editing).
  let locationData: MyLocation | null = null;
  let locationMarker: THREE.Object3D | null = null;
  let locationAnchor: THREE.Object3D | null = null;

  const keyOf = (kind: string, id: string): string => `${kind}:${id}`;

  const clearEdit = (): void => {
    if (previewNode) {
      previewNode.object.parent?.remove(previewNode.object);
      disposeDeep(previewNode.object);
      previewNode = null;
    }
    if (anchor) {
      disposeHandleMaterials(anchor);
      anchor.parent?.remove(anchor);
      disposeDeep(anchor);
      anchor = null;
    }
    if (hiddenOriginal) {
      hiddenOriginal.object.visible = true;
      hiddenOriginal = null;
    }
    if (buildingShift) {
      for (const n of buildingShift.moved) {
        n.object.position.x -= buildingShift.dx;
        n.object.position.z -= buildingShift.dz;
      }
      buildingShift = null;
    }
  };

  const clearLocation = (): void => {
    if (locationMarker) {
      locationMarker.parent?.remove(locationMarker);
      disposeDeep(locationMarker);
      locationMarker = null;
    }
    if (locationAnchor) {
      disposeHandleMaterials(locationAnchor);
      locationAnchor.parent?.remove(locationAnchor);
      disposeDeep(locationAnchor);
      locationAnchor = null;
    }
  };

  // The marker + its drag anchor are children of `root` so they inherit
  // the campus centering offset, like the entity nodes. Rebuilt whenever
  // the location or the root changes.
  const rebuildLocation = (): void => {
    clearLocation();
    if (!(root && locationData && graphRef)) {
      return;
    }
    locationMarker = buildLocationMarker(graphRef, locationData);
    root.add(locationMarker);
    locationAnchor = buildLocationAnchor(graphRef, locationData);
    root.add(locationAnchor);
  };

  const clearGraph = (): void => {
    clearEdit();
    clearLocation();
    if (root) {
      scene.remove(root);
      disposeDeep(root);
    }
    root = null;
    nodes = [];
    nodesByKey = new Map();
    storeys = null;
  };

  const setGraph = (graph: FullGraph | null): void => {
    if (graph === graphRef) {
      return;
    }
    graphRef = graph;
    clearGraph();
    if (!graph) {
      return;
    }
    const built = buildKioskCampus(graph);
    root = built.root;
    nodes = built.nodes;
    nodesByKey = new Map(nodes.map((n) => [keyOf(n.kind, n.id), n]));
    storeys = buildStoreyResolver(graph.classrooms);
    scene.add(root);
    rebuildLocation(); // re-attach any existing marker to the fresh root
  };

  const setMyLocation = (loc: MyLocation | null): void => {
    locationData = loc;
    rebuildLocation();
  };

  const applyAppearance = (app: EditorAppearance): void => {
    applyEditorAppearance(nodes, app);
    // Keep the edited entity's original hidden under the preview node.
    if (hiddenOriginal) {
      hiddenOriginal.object.visible = false;
    }
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported edit-state machine, kept verbatim
  const setEdit = (target: EditTarget | null): void => {
    clearEdit();
    if (!(target && root && graphRef && storeys)) {
      return;
    }

    const merged = mergeEntity(graphRef, target);

    if (merged.kind === 'building') {
      // Preview a building move by translating its existing nodes.
      if (target.id) {
        const saved = graphRef.buildings.find((b) => b.id === target.id);
        if (saved) {
          const dx = merged.entity.x - saved.x;
          const dz = merged.entity.y - saved.y;
          if (dx !== 0 || dz !== 0) {
            const moved = nodes.filter((n) => n.buildingId === target.id);
            for (const n of moved) {
              n.object.position.x += dx;
              n.object.position.z += dz;
            }
            buildingShift = { dx, dz, moved };
          }
        }
      }
    } else {
      // Hide the saved node and render the in-flight preview in its place.
      if (target.id) {
        const original = nodesByKey.get(keyOf(target.kind, target.id));
        if (original) {
          original.object.visible = false;
          hiddenOriginal = original;
        }
      }
      const node = buildPreviewNode(merged, graphRef, storeys);
      if (node) {
        accentNode(node);
        root.add(node.object);
        previewNode = node;
      }
    }

    const a = buildEditAnchor(merged, graphRef, storeys);
    if (a) {
      root.add(a);
      attachHandles(a, target.kind);
      anchor = a;
    }
  };

  return {
    applyAppearance,
    dispose: clearGraph,
    // Entity editing takes precedence; otherwise the location marker is
    // the draggable target.
    getGizmoTarget: () => anchor ?? locationAnchor,
    setEdit,
    setGraph,
    setMyLocation,
  };
}
