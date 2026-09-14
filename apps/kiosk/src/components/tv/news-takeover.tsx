import {
  type NewsTakeoverPolicy,
  useFeaturedNews,
  useNewsSlideshow,
} from '@/hooks/tv';
import { apiBaseUrl } from '@/utils/api';

type NewsTakeoverProps = {
  /** Milliseconds each item stays on screen. */
  dwellMs: number;
  /** Which items this box presents full screen. */
  policy: NewsTakeoverPolicy;
  /** Milliseconds the ticker shows between takeover rounds. */
  tickerMs: number;
};

/**
 * Full-screen takeover for the featured announcements: one item at a time, in
 * the feed's own order, then back to the ticker. Rendered as a sibling of the
 * ticker (never inside it) — the TV shell zooms its `main` element, so a fixed
 * overlay in there would be scaled and cover the wrong area.
 *
 * Titles stay off the kiosk: a featured item shows its image edge to edge, or,
 * when there is no image to show, the announcement text on its own.
 */
export function NewsTakeover({ dwellMs, policy, tickerMs }: NewsTakeoverProps) {
  const { featured } = useFeaturedNews(policy);
  const { advance, current } = useNewsSlideshow(featured, {
    dwellMs,
    tickerMs,
  });

  if (!current) {
    return null;
  }

  const imageUrl =
    policy.newsImages && current.imageVersion
      ? `${apiBaseUrl}/kiosk/news/${current.id}/image?v=${encodeURIComponent(current.imageVersion)}`
      : null;

  return (
    <div className="fixed inset-0 z-[1100] flex flex-col bg-background text-foreground">
      {/* Top-of-screen progress bar: how long this item still stays. Keyed by
          the item so each one starts its own fill. */}
      <div
        className="takeover-progress h-2 w-full shrink-0 bg-primary"
        key={`${current.id}:${current.imageVersion ?? ''}`}
        style={{ animationDuration: `${dwellMs}ms` }}
      />
      {imageUrl ? (
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: a broken image is skipped by the rotation
        <img
          alt=""
          className="min-h-0 w-full flex-1 object-contain"
          height={1080}
          onError={advance}
          src={imageUrl}
          width={1920}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <p className="max-w-5xl text-4xl text-shadow">{current.body}</p>
        </div>
      )}
    </div>
  );
}
