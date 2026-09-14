import { useEffect } from 'react';

/** User-activity events that count as "the kiosk is in use". */
const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
  'touchmove',
] as const satisfies readonly (keyof WindowEventMap)[];

/**
 * Fires `onIdle` after `timeoutMs` of no user activity. Any tracked input
 * event restarts the countdown. Pass a stable `onIdle` (e.g. a `useCallback`)
 * so the listeners aren't torn down and rebuilt on every render.
 *
 * `pointermove`/`touchmove` are throttled so dragging the 3D view doesn't
 * reset the timer on every frame.
 */
export function useIdleTimer(onIdle: () => void, timeoutMs = 60_000): void {
  useEffect(() => {
    let timer: number;
    let lastMove = 0;

    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onIdle, timeoutMs);
    };

    // Coalesce high-frequency move events to at most one reset per 250ms.
    const onActivity = (event: Event) => {
      if (event.type === 'pointermove' || event.type === 'touchmove') {
        const now = Date.now();
        if (now - lastMove < 250) {
          return;
        }
        lastMove = now;
      }

      reset();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    reset();

    return () => {
      window.clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [onIdle, timeoutMs]);
}
