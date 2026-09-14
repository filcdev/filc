import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import type { MyLocation } from '@filcdev/api/domains/navigator/my-location';
import { useEffect, useRef } from 'react';
// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import AxisGizmo from './axis-gizmo';
import { buildAxes } from './blueprint/axes-builder';
import {
  createEditorScene,
  type EditorSceneController,
} from './editor/editor-scene';
import type { EditorAppearance, EditTarget } from './editor/types';
import { attachGizmoInteraction } from './gizmo/attach-gizmo-interaction';
import { createRenderLoop } from './runtime/render-loop';
import { createCamera, createRenderer, createScene } from './runtime/renderer';
import { observeContainerResize } from './runtime/resize-observer';
import type { ResizePatch } from './types/three/gizmo-types';

type Props = {
  graph: FullGraph | null;
  /** Filter + emphasis, applied in place (no geometry rebuild). */
  appearance?: EditorAppearance;
  /** Entity being edited (shows gizmo + live preview). `null` = none. */
  edit?: EditTarget | null;
  /** Optional draggable "my location" marker. When set (and no entity is
   *  being edited) its translate handle drives `onTransform` with x/y. */
  myLocation?: MyLocation | null;
  /** Gizmo drag patch — fold into the form, same shape as the old onResize. */
  onTransform?: (patch: ResizePatch) => void;
  showAxes?: boolean;
  className?: string;
  initialDistance?: number;
  background?: number;
  /** Text shown instead of the canvas while no graph is available. */
  emptyLabel?: string;
};

/**
 * Editor 3D view. Geometry, appearance, and interaction are decoupled
 * (see src/three/editor/* — built on the shared kiosk geometry): the
 * campus is built once per graph, appearance is a cheap in-place pass on
 * every state change, and the single edited entity gets a live preview
 * node + a gizmo anchor. This component only owns the React/Three
 * lifecycle and bridges props/callbacks to those layers.
 */
export default function EditorView3D({
  graph,
  appearance,
  edit,
  myLocation,
  onTransform,
  showAxes,
  background,
  className = 'w-full h-full',
  initialDistance,
  emptyLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const controllerRef = useRef<EditorSceneController | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Latest callback read by the (long-lived) gizmo handler.
  const onTransformRef = useRef(onTransform);
  useEffect(() => {
    onTransformRef.current = onTransform;
  }, [onTransform]);

  // Change-tracking so we only re-sync the graph when it actually changes.
  const graphRef = useRef<FullGraph | null | undefined>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const renderer = createRenderer(container);
    const scene = createScene();
    rendererRef.current = renderer;
    sceneRef.current = scene;
    const camera = createCamera(initialDistance ?? 80);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const axes = showAxes ? buildAxes() : null;
    if (axes) {
      for (const object of axes.objects) {
        scene.add(object);
      }
    }

    cameraRef.current = camera;
    controlsRef.current = controls;

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

    const controller = createEditorScene(scene);
    controllerRef.current = controller;

    const detachGizmo = attachGizmoInteraction({
      camera,
      canvas: renderer.domElement,
      controls,
      getOnResize: () => onTransformRef.current,
      getTarget: () => controller.getGizmoTarget(),
      requestRender: loop.requestRender,
    });

    // Force a fresh sync on (re)mount.
    graphRef.current = undefined;
    loop.requestRender();

    return () => {
      loop.stop();
      stopResize();
      detachGizmo();
      controls.removeEventListener('change', loop.requestRender);
      controls.removeEventListener('start', loop.requestRender);
      controls.dispose();
      axes?.dispose();
      controller.dispose();
      controllerRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      requestRenderRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      renderer.dispose();
      renderer.forceContextLoss();
      container.removeChild(renderer.domElement);
    };
  }, [initialDistance, showAxes]);

  // Sync graph + appearance + edit on any relevant prop change. Order
  // matters: setGraph, then appearance, then edit (so the edited entity's
  // original node stays hidden under its live preview).
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }

    controller.setGraph(graph);
    graphRef.current = graph;
    controller.applyAppearance(appearance ?? {});
    controller.setEdit(edit ?? null);
    controller.setMyLocation(myLocation ?? null);

    requestRenderRef.current?.();
  }, [graph, appearance, edit, myLocation]);

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

      {showAxes && (
        <AxisGizmo cameraRef={cameraRef} controlsRef={controlsRef} />
      )}

      {!graph && (
        <div className="absolute inset-0 grid place-items-center text-cyan-300 text-sm">
          {emptyLabel ?? ''}
        </div>
      )}
    </div>
  );
}

export type { EditorAppearance, EditTarget } from './editor/types';
