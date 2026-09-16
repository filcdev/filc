import { useEffect, useState } from 'react';
import { usePetrikNews, usePetrikNewsSlideshow } from '@/hooks/petrik-news';

type PetrikNewsOverlayProps = {
  /** Milliseconds each item stays on screen. */
  dwellMs: number;
  /** The box's own identity, used to resolve its configured feed URL. */
  machine: string;
  onDismiss: () => void;
};

/**
 * Full-screen petrik.hu news slideshow for the navigator kiosk: one article at
 * a time, an image edge to edge, or the title alone when there is no image.
 * Any touch or key press dismisses it back to the navigator.
 */
export function PetrikNewsOverlay({
  dwellMs,
  machine,
  onDismiss,
}: PetrikNewsOverlayProps) {
  const { items } = usePetrikNews(machine);
  const { advance, current } = usePetrikNewsSlideshow(items, dwellMs);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());

  // A refetched feed can change length; restart failure tracking so stale
  // failures cannot dismiss a freshly loaded overlay.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the length is the trigger, not a value the effect reads
  useEffect(() => {
    setFailedUrls(new Set());
  }, [items.length]);

  const imageCount = items.filter((item) => item.imageUrl !== null).length;

  // Dismiss only when there is genuinely nothing left to show: every item has
  // an image AND all of them failed. A mixed feed (some title-only items) stays
  // alive, since title-only items never fail to load.
  useEffect(() => {
    if (
      imageCount === items.length &&
      imageCount > 0 &&
      failedUrls.size >= imageCount
    ) {
      onDismiss();
    }
  }, [imageCount, items.length, failedUrls, onDismiss]);

  useEffect(() => {
    const dismiss = () => onDismiss();
    // `pointermove` is the primary "user is back" signal: the news closes as
    // soon as the pointer moves, no click needed. `pointerup` (not
    // `pointerdown`) so a dismissing release cannot fall through to the 3D
    // canvas underneath, which selects a classroom on pointerup.
    window.addEventListener('pointermove', dismiss, { once: true });
    window.addEventListener('pointerup', dismiss, { once: true });
    window.addEventListener('keydown', dismiss, { once: true });

    return () => {
      window.removeEventListener('pointermove', dismiss);
      window.removeEventListener('pointerup', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [onDismiss]);

  if (!current) {
    return null;
  }

  const handleImageError = () => {
    setFailedUrls((previous) => {
      const next = new Set(previous);
      next.add(current.url);
      return next;
    });
    advance();
  };

  return (
    <div className="fixed inset-0 z-[1100] flex flex-col bg-background text-foreground">
      {/* Top-of-screen progress bar: how long this item still stays. Keyed by
          the item so each one starts its own fill. */}
      <div
        className="takeover-progress h-2 w-full shrink-0 bg-primary"
        key={current.url}
        style={{ animationDuration: `${dwellMs}ms` }}
      />
      {current.imageUrl ? (
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: a broken image is skipped by the rotation
        <img
          alt=""
          className="min-h-0 w-full flex-1 object-contain"
          height={1080}
          onError={handleImageError}
          src={current.imageUrl}
          width={1920}
        />
      ) : null}
      <div
        className={`w-full px-12 py-10 ${
          current.imageUrl ? 'shrink-0' : 'flex flex-1 flex-col justify-center'
        }`}
      >
        <h2 className="font-bold text-5xl leading-tight md:text-6xl">
          {current.title}
        </h2>
        {current.body && (
          <p className="mt-4 text-2xl text-muted-foreground leading-snug md:text-3xl">
            {current.body}
          </p>
        )}
      </div>
    </div>
  );
}
