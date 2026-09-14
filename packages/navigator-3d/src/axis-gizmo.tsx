import { type RefObject, useCallback, useEffect, useRef } from 'react';
import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { projectAxes, snapCameraToAxis } from './runtime/axis-gizmo-math';
import { AXES, type Axis } from './types/three/axis-types';

const SIZE = 110;
const RADIUS = 36;
const TIP_R = 13;

type Props = {
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: RefObject<OrbitControls | null>;
};

// Blender-style orientation gizmo. SVG overlay listening to OrbitControls
// "change" events — the projection math lives in axisGizmoMath.ts so this
// file only handles SVG mutation and React lifecycle.
export default function AxisGizmo({ cameraRef, controlsRef }: Props) {
  const tipRefs = useRef<Array<SVGGElement | null>>([]);
  const lineRefs = useRef<Array<SVGLineElement | null>>([]);

  const lockTo = useCallback(
    (dir: Axis['dir']) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!(camera && controls)) {
        return;
      }
      snapCameraToAxis(camera, controls.target, dir);
      controls.update();
    },
    [cameraRef, controlsRef]
  );

  useEffect(() => {
    let raf = 0;
    let attached = false;
    let detach: (() => void) | null = null;

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: gizmo RAF update loop, ported verbatim
    const update = (): void => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!(camera && controls)) {
        return;
      }

      const projected = projectAxes(camera, controls.target, RADIUS);

      for (const p of projected) {
        const g = tipRefs.current[p.index];
        if (!g) {
          continue;
        }
        g.setAttribute(
          'transform',
          `translate(${SIZE / 2 + p.screenX}, ${SIZE / 2 + p.screenY})`
        );
        g.setAttribute('opacity', (p.depth >= 0 ? 1 : 0.4).toFixed(2));
      }
      for (let i = 0; i < 3; i++) {
        const line = lineRefs.current[i];
        if (!line) {
          continue;
        }
        const p = projected[i * 2];
        if (!p) {
          continue;
        }
        line.setAttribute('x2', String(SIZE / 2 + p.screenX));
        line.setAttribute('y2', String(SIZE / 2 + p.screenY));
        line.setAttribute('opacity', (p.depth >= 0 ? 0.85 : 0.3).toFixed(2));
      }
    };

    // Child effects run before parent's, so controlsRef.current is
    // still null right after mount. Poll via RAF until ready.
    const tryAttach = (): void => {
      const controls = controlsRef.current;
      if (!attached && controls) {
        attached = true;
        controls.addEventListener('change', update);
        controls.addEventListener('end', update);
        detach = () => {
          controls.removeEventListener('change', update);
          controls.removeEventListener('end', update);
        };
        update();
        return;
      }
      raf = requestAnimationFrame(tryAttach);
    };
    tryAttach();

    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      detach?.();
    };
  }, [cameraRef, controlsRef]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-3 right-3 select-none"
      style={{ height: SIZE, width: SIZE }}
    >
      <svg
        height={SIZE}
        style={{ overflow: 'visible' }}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
      >
        <title>Camera orientation</title>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="rgba(15, 23, 42, 0.55)"
          r={SIZE / 2 - 2}
          stroke="rgba(255, 255, 255, 0.08)"
        />
        {[0, 1, 2].map((i) => {
          const positive = AXES[i * 2];
          if (!positive) {
            return null;
          }
          return (
            <line
              key={`line-${i}`}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              stroke={positive.color}
              strokeLinecap="round"
              strokeWidth={2.5}
              x1={SIZE / 2}
              x2={SIZE / 2}
              y1={SIZE / 2}
              y2={SIZE / 2}
            />
          );
        })}
        {AXES.map((axis, i) => (
          // biome-ignore lint/a11y/useSemanticElements: SVG tip group; <button> is invalid inside <svg>
          <g
            aria-label={axis.label}
            key={axis.label}
            onClick={() => lockTo(axis.dir)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                lockTo(axis.dir);
              }
            }}
            ref={(el) => {
              tipRefs.current[i] = el;
            }}
            role="button"
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            tabIndex={0}
            transform={`translate(${SIZE / 2}, ${SIZE / 2})`}
          >
            <circle cx={0} cy={0} fill="transparent" r={TIP_R + 4} />
            {axis.positive ? (
              <>
                <circle
                  cx={0}
                  cy={0}
                  fill={axis.color}
                  r={TIP_R}
                  stroke="rgba(0, 0, 0, 0.4)"
                  strokeWidth={1}
                />
                <text
                  dominantBaseline="central"
                  fill="white"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontSize={13}
                  fontWeight={700}
                  style={{ userSelect: 'none' }}
                  textAnchor="middle"
                  x={0}
                  y={1}
                >
                  {axis.label}
                </text>
              </>
            ) : (
              <circle
                cx={0}
                cy={0}
                fill="none"
                r={TIP_R - 3}
                stroke={axis.color}
                strokeWidth={2}
              />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
