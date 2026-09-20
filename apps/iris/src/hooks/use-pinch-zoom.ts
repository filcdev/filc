import { useEffect, useRef, useState } from 'react';

const MIN_SCALE = 0.25;
const MAX_SCALE = 1.5;

export function usePinchZoom<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(scale);
  const pinch = useRef<{ distance: number; base: number } | null>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const getDistance = (touches: TouchList) =>
      Math.hypot(
        (touches[0]?.clientX ?? 0) - (touches[1]?.clientX ?? 0),
        (touches[0]?.clientY ?? 0) - (touches[1]?.clientY ?? 0)
      );

    const handleStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) {
        return;
      }
      pinch.current = {
        base: scaleRef.current,
        distance: getDistance(event.touches),
      };
    };

    const handleMove = (event: TouchEvent) => {
      const state = pinch.current;
      if (event.touches.length !== 2 || !state || state.distance === 0) {
        return;
      }
      event.preventDefault();
      const ratio = getDistance(event.touches) / state.distance;
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.base * ratio)));
    };

    const handleEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        pinch.current = null;
      }
    };

    element.addEventListener('touchstart', handleStart, { passive: true });
    element.addEventListener('touchmove', handleMove, { passive: false });
    element.addEventListener('touchend', handleEnd, { passive: true });
    element.addEventListener('touchcancel', handleEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('touchcancel', handleEnd);
    };
  }, []);

  return { ref, scale };
}
