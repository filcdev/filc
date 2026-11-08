import { Button } from '@filcdev/ui/components/button';
import { ZoomIn, ZoomOut } from 'lucide-react';
import {
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

/** The visible frame, in CSS pixels: the whole picture is shown inside it. */
const FRAME = 288;
/** The crop circle's diameter when the picture allows it. */
const DEFAULT_CROP = 224;
/** The smallest circle worth cropping, as a floor for tiny pictures. */
const MIN_CROP = 96;
/** The exported picture's edge, in pixels; never shown larger. */
const OUTPUT_SIZE = 512;

export type AvatarCropperHandle = {
  /** The circle's contents as a file, or `null` when there is nothing to crop. */
  export: () => Promise<File | null>;
  reset: () => void;
};

type Size = { height: number; width: number };

/** The picture's displayed size: fitted inside the frame, aspect kept. */
type PictureRect = { height: number; width: number };

/** A point in frame coordinates. */
type Point = { x: number; y: number };

/**
 * The frame is the picture's own box, so nothing is letterboxed: the dimming
 * always falls on the picture rather than on empty space beside it.
 */
const pictureRect = (size: Size): PictureRect => {
  const scale = Math.min(FRAME / size.width, FRAME / size.height);
  return { height: size.height * scale, width: size.width * scale };
};

const clampToRange = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/** How far the circle's centre may travel and still sit on the picture. */
const centreBounds = (rect: PictureRect, crop: number) => {
  const radius = crop / 2;
  return {
    maxX: rect.width - radius,
    maxY: rect.height - radius,
    minX: radius,
    minY: radius,
  };
};

/**
 * The largest circle the picture can hold: its shorter side.
 */
const maxCrop = (size: Size): number => {
  const { height, width } = pictureRect(size);
  return Math.min(width, height);
};

/**
 * A circular crop of a picked picture, shown inside a square frame. Nothing
 * about the picture ever moves or scales — the whole image stays where it is —
 * and the circle is the only thing the user changes: drag it over the part
 * worth keeping, and the slider resizes it. Everything outside it dims.
 *
 * Written against the canvas rather than a cropping library: the crop is a
 * fixed circle over a static picture, so all a library would add is a drag
 * handle — while costing a dependency and a stylesheet. The exported file is a
 * fixed-size WebP, which keeps the upload far below the server's cap whatever
 * the source picture's dimensions are.
 */
export function AvatarCropper({
  file,
  ref,
}: {
  file: File;
  ref?: Ref<AvatarCropperHandle>;
}) {
  const { t } = useTranslation();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    origin: Point;
    pointerX: number;
    pointerY: number;
  } | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [crop, setCrop] = useState(DEFAULT_CROP);
  const [centre, setCentre] = useState<Point>({
    x: FRAME / 2,
    y: FRAME / 2,
  });

  // Deliberately not revoked: a cleanup would run on React's development
  // double-mount and revoke the URL the re-mounted element still points at, and
  // the browser drops blob URLs with the document anyway. One per picked file.
  const src = useMemo(() => URL.createObjectURL(file), [file]);

  const reset = useCallback(() => {
    if (size) {
      const rect = pictureRect(size);
      setCrop(Math.min(DEFAULT_CROP, maxCrop(size)));
      setCentre({ x: rect.width / 2, y: rect.height / 2 });
    }
  }, [size]);

  // Shrinking the circle or loading a small picture can leave it half outside
  // the image; keep it inside both the image and the frame.
  useEffect(() => {
    if (!size) {
      return;
    }
    const bounds = centreBounds(pictureRect(size), crop);
    setCentre((current) => ({
      x: clampToRange(current.x, bounds.minX, bounds.maxX),
      y: clampToRange(current.y, bounds.minY, bounds.maxY),
    }));
  }, [crop, size]);

  const exportCrop = useCallback(async (): Promise<File | null> => {
    const image = imgRef.current;
    if (!(image && size)) {
      return null;
    }

    const rect = pictureRect(size);
    const scale = rect.width / size.width;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      (centre.x - crop / 2) / scale,
      (centre.y - crop / 2) / scale,
      crop / scale,
      crop / scale,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    );

    const { promise, resolve } = Promise.withResolvers<Blob | null>();
    canvas.toBlob(resolve, 'image/webp', 0.9);
    const blob = await promise;
    if (!blob) {
      return null;
    }

    return new File([blob], `avatar-${crypto.randomUUID()}.webp`, {
      type: 'image/webp',
    });
  }, [centre, crop, size]);

  useImperativeHandle(ref, () => ({ export: exportCrop, reset }), [
    exportCrop,
    reset,
  ]);

  const rect = size ? pictureRect(size) : null;
  const max = size ? maxCrop(size) : DEFAULT_CROP;
  const min = Math.min(MIN_CROP, max);

  return (
    <div className="space-y-3">
      <div
        className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-xl ring-1 ring-border active:cursor-grabbing"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            origin: centre,
            pointerX: event.clientX,
            pointerY: event.clientY,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!(drag && rect)) {
            return;
          }
          const bounds = centreBounds(rect, crop);
          // The circle may not leave the picture: the picture is static, so its
          // rect is the limit, not the frame.
          setCentre({
            x: clampToRange(
              drag.origin.x + (event.clientX - drag.pointerX),
              bounds.minX,
              bounds.maxX
            ),
            y: clampToRange(
              drag.origin.y + (event.clientY - drag.pointerY),
              bounds.minY,
              bounds.maxY
            ),
          });
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        style={{ height: rect?.height ?? FRAME, width: rect?.width ?? FRAME }}
      >
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the load event carries the picture's dimensions; the drag is handled by the frame. */}
        {/* biome-ignore lint/correctness/useImageSize: the size is computed from the picture and lives in `style`. */}
        <img
          alt=""
          className="absolute max-w-none select-none"
          draggable={false}
          onLoad={(event) => {
            const natural = {
              height: event.currentTarget.naturalHeight,
              width: event.currentTarget.naturalWidth,
            };
            const fitted = pictureRect(natural);
            setSize(natural);
            // The circle must fit on the picture's shorter side.
            setCrop(Math.min(DEFAULT_CROP, maxCrop(natural)));
            setCentre({ x: fitted.width / 2, y: fitted.height / 2 });
          }}
          ref={imgRef}
          src={src}
          style={{
            height: rect?.height,
            left: 0,
            top: 0,
            width: rect?.width,
          }}
        />

        {/* The crop circle, lit: its shadow dims everything around it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-1 ring-white/70"
          style={{
            height: crop,
            left: centre.x - crop / 2,
            top: centre.y - crop / 2,
            width: crop,
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          aria-label={t('profile.picture.cropSize')}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          max={max}
          min={min}
          onChange={(event) => setCrop(Number(event.target.value))}
          step={1}
          type="range"
          value={crop}
        />
        <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Button onClick={reset} size="sm" type="button" variant="ghost">
          {t('profile.picture.reset')}
        </Button>
      </div>

      <p className="text-center text-muted-foreground text-xs">
        {t('profile.picture.cropHint')}
      </p>
    </div>
  );
}
