import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import type { MyLocation } from '@filcdev/api/domains/navigator/my-location';
import type * as THREE from 'three';
import { buildKioskCampus } from '../entities/build-kiosk-campus';
import { buildLocationMarker } from '../entities/location-marker';
import type { Vec3 } from '../types/three/vector';
import { applyAppearance } from './appearance';
import { disposeDeep } from './materials';
import { buildKioskPath } from './path-overlay';
import type { KioskAppearance, KioskNode } from './types';

/** Owns the campus geometry for the kiosk. Geometry is rebuilt only when
 *  the graph identity changes; everything else (isolation, selection,
 *  highlight) is a cheap in-place appearance pass. */
export type KioskSceneController = {
  /** (Re)build geometry for a graph. No-op if the same graph instance. */
  setGraph: (graph: FullGraph | null, locationMarkerLabel: string) => void;
  /** Apply visibility + colors for the current state. */
  apply: (state: KioskAppearance) => void;
  /** Set (or clear) the A* route overlay. Cheap; rebuilds only the path. */
  setPath: (path: Vec3[] | null | undefined) => void;
  /** Set (or clear) the "you are here" marker overlay. */
  setMyLocation: (
    loc: MyLocation | null | undefined,
    locationMarkerLabel: string
  ) => void;
  getNodes: () => KioskNode[];
  getRoot: () => THREE.Group | null;
  dispose: () => void;
};

export function createKioskScene(scene: THREE.Scene): KioskSceneController {
  let root: THREE.Group | null = null;
  let nodes: KioskNode[] = [];
  let graphRef: FullGraph | null = null;
  let pathGroup: THREE.Group | null = null;
  let pathData: Vec3[] | null = null;
  let markerGroup: THREE.Group | null = null;
  let markerData: MyLocation | null = null;

  // The path overlay is a child of `root` so it inherits the campus
  // centering offset. It is rebuilt whenever the path or the root changes.
  const rebuildPath = (): void => {
    if (pathGroup) {
      pathGroup.parent?.remove(pathGroup);
      disposeDeep(pathGroup);
      pathGroup = null;
    }
    if (root && pathData && pathData.length >= 2) {
      pathGroup = buildKioskPath(pathData);
      root.add(pathGroup);
    }
  };

  // The marker is a child of `root` too, for the same centering reason.
  const rebuildMarker = (locationMarkerLabel: string): void => {
    if (markerGroup) {
      markerGroup.parent?.remove(markerGroup);
      disposeDeep(markerGroup);
      markerGroup = null;
    }
    if (root && markerData && graphRef) {
      markerGroup = buildLocationMarker(
        graphRef,
        markerData,
        locationMarkerLabel
      );
      root.add(markerGroup);
    }
  };

  const clear = (): void => {
    if (root) {
      scene.remove(root);
      disposeDeep(root); // also disposes path/marker groups (children of root)
    }
    root = null;
    nodes = [];
    pathGroup = null;
    markerGroup = null;
  };

  const setGraph = (
    graph: FullGraph | null,
    locationMarkerLabel: string
  ): void => {
    if (graph === graphRef) {
      return;
    }
    graphRef = graph;
    clear();
    if (!graph) {
      return;
    }
    const built = buildKioskCampus(graph);
    root = built.root;
    nodes = built.nodes;
    scene.add(root);
    rebuildPath(); // re-attach any existing path to the fresh root
    rebuildMarker(locationMarkerLabel); // re-attach any existing marker to the fresh root
  };

  const setPath = (path: Vec3[] | null | undefined): void => {
    pathData = path ?? null;
    rebuildPath();
  };

  const setMyLocation = (
    loc: MyLocation | null | undefined,
    locationMarkerLabel: string
  ): void => {
    markerData = loc ?? null;
    rebuildMarker(locationMarkerLabel);
  };

  const apply = (state: KioskAppearance): void => {
    applyAppearance(nodes, state);
  };

  return {
    apply,
    dispose: clear,
    getNodes: () => nodes,
    getRoot: () => root,
    setGraph,
    setMyLocation,
    setPath,
  };
}
