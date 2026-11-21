import type { IScannerControls } from '@zxing/browser';
import { useCallback, useEffect, useRef, useState } from 'react';

/** What the camera box says when the device will not give us a stream. */
export type CameraFailure = 'denied' | 'unavailable';

const failureOf = (error: unknown): CameraFailure => {
  const name = error instanceof Error ? error.name : '';
  return name === 'NotAllowedError' || name === 'SecurityError'
    ? 'denied'
    : 'unavailable';
};

/**
 * The camera half of the scanner.
 *
 * `@zxing/browser` is imported inside the effect, so the decoder is a chunk of
 * its own and a helper who only ever types a code never downloads it. The
 * stream is torn down whenever `active` turns false — which is how a result
 * pauses the camera — and a failure pauses it too, so `retry` (which clears
 * the failure) is what starts it again.
 */
export const useScanner = (active: boolean, onCode: (code: string) => void) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failure, setFailure] = useState<CameraFailure | null>(null);
  // The decode callback fires many times a second; the latest handler is held
  // in a ref so a re-render never restarts the camera.
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  });

  const running = active && failure === null;

  useEffect(() => {
    if (!running) {
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let cancelled = false;
    let controls: IScannerControls | null = null;

    const start = async () => {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader();
        // Default device: the platform picks the rear camera on a phone.
        const started = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result) => {
            if (result) {
              onCodeRef.current(result.getText());
            }
          }
        );
        if (cancelled) {
          started.stop();
        } else {
          controls = started;
        }
      } catch (error) {
        if (!cancelled) {
          setFailure(failureOf(error));
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [running]);

  const retry = useCallback(() => {
    setFailure(null);
  }, []);

  return { failure, retry, videoRef };
};
