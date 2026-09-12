import type * as THREE from 'three';
import { buildKioskCampus } from '../entities/build-campus';
import type { FullGraph } from '../types/full-graph';
import { applyAppearance } from './appearance';
import { disposeDeep } from './materials';
import type { KioskAppearance, KioskNode } from './types';

/** Owns the campus geometry for the kiosk. Geometry is rebuilt only when
 *  the graph identity changes; everything else (isolation, selection,
 *  highlight) is a cheap in-place appearance pass. */
export type KioskSceneController = {
  /** (Re)build geometry for a graph. No-op if the same graph instance. */
  setGraph: (graph: FullGraph | null) => void;
  /** Apply visibility + colors for the current state. */
  apply: (state: KioskAppearance) => void;
  getNodes: () => KioskNode[];
  getRoot: () => THREE.Group | null;
  dispose: () => void;
};

export function createKioskScene(scene: THREE.Scene): KioskSceneController {
  let root: THREE.Group | null = null;
  let nodes: KioskNode[] = [];
  let graphRef: FullGraph | null = null;

  const clear = (): void => {
    if (root) {
      scene.remove(root);
      disposeDeep(root);
    }
    root = null;
    nodes = [];
  };

  const setGraph = (graph: FullGraph | null): void => {
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
  };
}
