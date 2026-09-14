import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import type { MyLocation } from '@filcdev/api/domains/navigator/my-location';
import { useEffect, useRef } from 'react';
// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type CameraRig, createCameraRig } from './kiosk/camera-rig';
import { attachKioskInteraction } from './kiosk/interaction';
import {
  createKioskScene,
  type KioskSceneController,
} from './kiosk/kiosk-scene';
import type {
  IsolatedFloor,
  KioskHighlight,
  KioskNode,
  KioskSelection,
} from './kiosk/types';
import { createRenderLoop } from './runtime/render-loop';
import { createCamera, createRenderer, createScene } from './runtime/renderer';
import { observeContainerResize } from './runtime/resize-observer';
import type { Vec3 } from './types/three/vector';

type Props = {
  graph: FullGraph | null;
  /** Which floor is isolated. `null`/undefined shows the whole campus. */
  isolatedFloor?: IsolatedFloor;
  /** Start/end classroom selection (owned by the parent). */
  selection?: KioskSelection;
  /** How to emphasize classrooms (by type, by id, …). */
  highlight?: KioskHighlight;
  /** A* route waypoints to draw as an overlay. Empty/undefined clears it. */
  path?: Vec3[];
  /** Optional "you are here" marker (red arrow + label). Undefined hides it. */
  myLocation?: MyLocation | null;
  /** Canvas/scene background color (e.g. derived from the light/dark theme).
   *  Updated live without rebuilding anything. */
  background?: number;
  /** Bump this number to force the camera back to the default campus
   *  framing (used by the idle reset). */
  viewResetToken?: number;
  onObjectClick?: (node: KioskNode) => void;
  onObjectHover?: (node: KioskNode | null) => void;
  className?: string;
  initialDistance?: number;
  /** Label drawn next to the "you are here" marker. */
  markerLabel?: string;
  /** Text shown instead of the canvas while no graph is available. */
  emptyLabel?: string;
};

function floorKeyOf(floor: IsolatedFloor): string {
  return floor ? `${floor.buildingId}:${floor.storey}` : '';
}

/**
 * Kiosk 3D view. Geometry, appearance, and interaction are fully
 * decoupled (see src/three/kiosk/*): geometry is built once per graph,
 * appearance is a cheap in-place pass on every state change, and picking
 * never rebuilds anything. This component only owns the React/Three
 * lifecycle and bridges props/callbacks to those layers.
 */
export default function KioskView3D({
  graph,
  isolatedFloor,
  selection,
  highlight,
  path,
  myLocation,
  background,
  viewResetToken,
  onObjectClick,
  onObjectHover,
  className = 'w-full h-full',
  initialDistance = 120,
  markerLabel,
  emptyLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const controllerRef = useRef<KioskSceneController | null>(null);
  const rigRef = useRef<CameraRig | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Change-tracking across renders so we only reframe when needed.
  const graphRef = useRef<FullGraph | null | undefined>(undefined);
  const floorKeyRef = useRef<string | null>(null);

  const onObjectHoverRef = useRef(onObjectHover);
  const onObjectClickRef = useRef(onObjectClick);
  useEffect(() => {
    onObjectHoverRef.current = onObjectHover;
  }, [onObjectHover]);
  useEffect(() => {
    onObjectClickRef.current = onObjectClick;
  }, [onObjectClick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const renderer = createRenderer(container);
    const scene = createScene();
    rendererRef.current = renderer;
    sceneRef.current = scene;
    const camera = createCamera(initialDistance);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // Constrained-but-free: keep the camera above ground, allow orbit/zoom/pan.
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 5;
    controls.maxDistance = 2000;

    const loop = createRenderLoop(renderer, scene, camera, controls);
    requestRenderRef.current = loop.requestRender;
    controls.addEventListener('change', loop.requestRender);
    controls.addEventListener('start', loop.requestRender);

    const stopResize = observeContainerResize(
      container,
      renderer,
      camera,
      loop.requestRender
    );

    const controller = createKioskScene(scene);
    controllerRef.current = controller;

    const rig = createCameraRig(
      camera,
      controls,
      () => controller.getRoot(),
      () => controller.getNodes(),
      loop.requestRender
    );
    rigRef.current = rig;

    const detachInteraction = attachKioskInteraction({
      camera,
      canvas: renderer.domElement,
      getNodes: () => controller.getNodes(),
      onHover: (pick) => {
        onObjectHoverRef.current?.(pick);
      },
      onPick: (pick) => {
        onObjectClickRef.current?.(pick);
      },
      requestRender: loop.requestRender,
    });

    // Force a fresh sync on (re)mount.
    graphRef.current = undefined;
    floorKeyRef.current = null;
    loop.requestRender();

    return () => {
      loop.stop();
      stopResize();
      detachInteraction();
      controls.removeEventListener('change', loop.requestRender);
      controls.removeEventListener('start', loop.requestRender);
      controls.dispose();
      controller.dispose();
      controllerRef.current = null;
      rigRef.current = null;
      requestRenderRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      renderer.dispose();
      renderer.forceContextLoss();
      container.removeChild(renderer.domElement);
    };
  }, [initialDistance]);

  // Sync graph + appearance + framing on any relevant prop change.
  useEffect(() => {
    const controller = controllerRef.current;
    const rig = rigRef.current;
    if (!controller) {
      return;
    }

    const graphChanged = graphRef.current !== graph;
    controller.setGraph(graph, markerLabel ?? '');
    graphRef.current = graph;

    controller.apply({
      highlight,
      isolatedFloor: isolatedFloor ?? null,
      selection,
    });
    controller.setPath(path);
    controller.setMyLocation(myLocation, markerLabel ?? '');

    const floorKey = floorKeyOf(isolatedFloor ?? null);
    const floorChanged = floorKeyRef.current !== floorKey;
    floorKeyRef.current = floorKey;

    // Reframe when the graph (re)loads or the isolated floor changes.
    if (graphChanged || floorChanged) {
      rig?.frameFloor(isolatedFloor ?? null);
    }

    requestRenderRef.current?.();
  }, [
    graph,
    isolatedFloor,
    selection,
    highlight,
    path,
    myLocation,
    markerLabel,
  ]);

  // Live theme background: recolor the clear color + scene background
  // without touching geometry.
  useEffect(() => {
    if (background == null) {
      return;
    }
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    if (!(renderer && scene)) {
      return;
    }
    renderer.setClearColor(background);
    if (scene.background instanceof THREE.Color) {
      scene.background.set(background);
    } else {
      scene.background = new THREE.Color(background);
    }
    requestRenderRef.current?.();
  }, [background]);

  // Idle/explicit reset: snap the camera back to the default campus shot.
  useEffect(() => {
    if (viewResetToken == null) {
      return;
    }
    rigRef.current?.frameCampus();
  }, [viewResetToken]);

  return (
    <div
      className={className}
      style={{
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

      {!graph && (
        <div className="absolute inset-0 grid place-items-center text-cyan-300 text-sm">
          {emptyLabel ?? ''}
        </div>
      )}
    </div>
  );
}

export type {
  IsolatedFloor,
  KioskHighlight,
  KioskSelection,
} from './kiosk/types';
