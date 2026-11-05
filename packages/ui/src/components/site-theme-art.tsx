import {
  backdropSlots,
  type MotifSlot,
  panelSlots,
  siteThemeArtFor,
} from '../lib/site-theme-art';
import { cn } from '../lib/utils';

type SiteThemeArtProps = {
  className?: string;
  /** A skin name from the API; an unknown one falls back to the everyday look. */
  theme: string;
};

const Motifs = ({
  slots,
  glyphs,
}: {
  glyphs: readonly string[];
  slots: readonly MotifSlot[];
}) =>
  slots.map((slot, index) => (
    <span
      className="absolute select-none font-emoji leading-none"
      key={`${slot.left}-${slot.top}`}
      // Positions come from the slot table, so they cannot be static classes.
      style={{
        fontSize: slot.size,
        left: slot.left,
        opacity: slot.opacity,
        rotate: slot.rotate,
        top: slot.top,
      }}
    >
      {glyphs[index % glyphs.length]}
    </span>
  ));

/**
 * The seasonal panel art: a theme-coloured wash with a scatter of emoji motifs,
 * sized by the parent (`absolute inset-0` in a hero, `h-full w-full` in a card).
 * Purely decorative — hidden from assistive tech and never interactive.
 */
export function SiteThemeArt({ className, theme }: SiteThemeArtProps) {
  const { glyphs, wash } = siteThemeArtFor(theme);

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none relative overflow-hidden',
        wash,
        className
      )}
    >
      {glyphs.length > 0 && <Motifs glyphs={glyphs} slots={panelSlots} />}
    </div>
  );
}

/**
 * The page-wide version: the same motifs on a fixed layer behind everything.
 * Mount it once per app next to the layout shell; it renders nothing for
 * `default`, which has no season to draw.
 */
export function SiteThemeBackdrop({ className, theme }: SiteThemeArtProps) {
  const { glyphs } = siteThemeArtFor(theme);

  if (glyphs.length === 0) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-0 -z-10 select-none overflow-hidden',
        className
      )}
    >
      <Motifs glyphs={glyphs} slots={backdropSlots} />
    </div>
  );
}
