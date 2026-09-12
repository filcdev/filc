import { useEffect, useRef } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { NavigatorGraph } from '@/hooks/navigator';
import { toFullGraph } from './adapter';
import { createCameraRig } from './kiosk/camera-rig';
import { createKioskScene } from './kiosk/kiosk-scene';
import { createRenderLoop } from './runtime/render-loop';
import { createCamera, createRenderer, createScene } from './runtime/renderer';
import { observeContainerResize } from './runtime/resize-observer';

type NavigatorPreviewProps = {
  graph: NavigatorGraph;
};

/**
 * Read-only Three.js preview of the navigator campus. Builds the campus
 * once per graph, orbits with the mouse, and disposes everything on
 * unmount.
 */
export function NavigatorPreview({ graph }: NavigatorPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const renderer = createRenderer(container);
    const scene = createScene();
    const camera = createCamera(120);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 5;
    controls.maxDistance = 2000;

    const loop = createRenderLoop(renderer, scene, camera, controls);
    controls.addEventListener('change', loop.requestRender);
    controls.addEventListener('start', loop.requestRender);

    const stopResize = observeContainerResize(
      container,
      renderer,
      camera,
      loop.requestRender
    );

    const controller = createKioskScene(scene);
    const rig = createCameraRig(
      camera,
      controls,
      () => controller.getRoot(),
      () => controller.getNodes(),
      loop.requestRender
    );

    controller.setGraph(toFullGraph(graph));
    controller.apply({ isolatedFloor: null });
    rig.frameCampus();
    loop.requestRender();

    return () => {
      loop.stop();
      stopResize();
      controls.removeEventListener('change', loop.requestRender);
      controls.removeEventListener('start', loop.requestRender);
      controls.dispose();
      controller.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      container.removeChild(renderer.domElement);
    };
  }, [graph]);

  return <div className="h-[480px] w-full" ref={containerRef} />;
}
