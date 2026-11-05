/**
 * The seasonal skins' decorative motifs, as emoji glyphs.
 *
 * Glyphs are drawn with the platform's emoji font (`font-emoji` in
 * `globals.css`) instead of shipping illustrations: nothing to download, no
 * attributions to carry, and a new skin is one line of data. The trade-off is
 * that the exact artwork belongs to the visitor's platform — Noto Color Emoji,
 * Apple Color Emoji and Segoe UI Emoji each draw these their own way — which is
 * why the wash underneath carries most of the colour and the glyphs are only
 * ever a scattered accent.
 *
 * A skin is `{ wash, glyphs }`: a Tailwind gradient for the panel background
 * and the motifs cycled across the shared slot layouts below. `default` has no
 * glyphs on purpose — it is the everyday look, not a season.
 */

export type MotifSlot = {
  left: `${number}%`;
  opacity: number;
  rotate: `${number}deg`;
  size: string;
  top: `${number}%`;
};

export type SiteThemeArtSpec = {
  glyphs: readonly string[];
  wash: string;
};

/**
 * Scattered across a full viewport in `SiteThemeBackdrop`, behind the content.
 * Deliberately irregular and never repeating: any pattern reads as wallpaper.
 */
export const backdropSlots: readonly MotifSlot[] = [
  { left: '7%', opacity: 0.5, rotate: '-12deg', size: '2.6rem', top: '10%' },
  { left: '79%', opacity: 0.38, rotate: '9deg', size: '3.4rem', top: '6%' },
  { left: '34%', opacity: 0.3, rotate: '-20deg', size: '1.7rem', top: '19%' },
  { left: '91%', opacity: 0.34, rotate: '14deg', size: '2rem', top: '31%' },
  { left: '17%', opacity: 0.28, rotate: '6deg', size: '1.5rem', top: '38%' },
  { left: '62%', opacity: 0.42, rotate: '-8deg', size: '2.8rem', top: '27%' },
  { left: '44%', opacity: 0.26, rotate: '18deg', size: '1.4rem', top: '46%' },
  { left: '86%', opacity: 0.3, rotate: '-16deg', size: '1.9rem', top: '57%' },
  { left: '5%', opacity: 0.38, rotate: '11deg', size: '2.4rem', top: '62%' },
  { left: '28%', opacity: 0.32, rotate: '-5deg', size: '2.1rem', top: '72%' },
  { left: '70%', opacity: 0.36, rotate: '7deg', size: '2.7rem', top: '76%' },
  { left: '48%', opacity: 0.24, rotate: '-14deg', size: '1.6rem', top: '88%' },
  { left: '93%', opacity: 0.28, rotate: '4deg', size: '1.8rem', top: '88%' },
  { left: '12%', opacity: 0.26, rotate: '-9deg', size: '1.5rem', top: '89%' },
];

/** A handful of larger motifs for a panel: the picker's hero and its cards. */
export const panelSlots: readonly MotifSlot[] = [
  { left: '4%', opacity: 0.9, rotate: '-10deg', size: '2.1em', top: '52%' },
  { left: '24%', opacity: 0.8, rotate: '12deg', size: '1.4em', top: '16%' },
  { left: '46%', opacity: 0.95, rotate: '-4deg', size: '2.6em', top: '58%' },
  { left: '68%', opacity: 0.85, rotate: '16deg', size: '1.6em', top: '14%' },
  { left: '84%', opacity: 0.9, rotate: '-12deg', size: '2.2em', top: '46%' },
];

export const siteThemeArt = {
  christmas: {
    glyphs: ['🎄', '⛄', '🎁', '❄️', '⭐', '🔔'],
    wash: 'bg-gradient-to-br from-green-600/15 via-sky-500/10 to-sky-600/15',
  },
  default: {
    glyphs: [],
    wash: 'bg-gradient-to-br from-teal-500/25 via-teal-600/5 to-teal-700/10',
  },
  easter: {
    glyphs: ['🐣', '🐰', '🥚', '🌷', '🐥'],
    wash: 'bg-gradient-to-br from-purple-400/20 via-yellow-300/10 to-emerald-400/15',
  },
  halloween: {
    glyphs: ['🎃', '🦇', '👻', '🌙', '🕸️', '⭐'],
    wash: 'bg-gradient-to-br from-violet-600/20 via-orange-500/10 to-orange-600/15',
  },
  march15: {
    // No 🇭🇺: Windows' emoji font has no flag glyphs and would print "HU",
    // which reads as a typo in the middle of the art.
    glyphs: ['🕊️', '🌷', '🏅', '⭐'],
    wash: 'bg-gradient-to-br from-red-600/15 via-emerald-500/10 to-green-600/15',
  },
  newYear: {
    glyphs: ['🎆', '🥂', '🎉', '✨', '⭐', '🍾'],
    wash: 'bg-gradient-to-br from-indigo-700/20 via-blue-900/10 to-amber-500/15',
  },
  summer: {
    glyphs: ['☀️', '🏖️', '🌊', '🍦', '🌴', '😎'],
    wash: 'bg-gradient-to-br from-sky-500/20 via-cyan-400/10 to-yellow-400/15',
  },
  valentines: {
    glyphs: ['❤️', '💌', '🌹', '💕', '💘'],
    wash: 'bg-gradient-to-br from-rose-500/20 via-pink-500/10 to-rose-600/15',
  },
} as const;

export type SiteThemeName = keyof typeof siteThemeArt;

/** The spec for a skin, or the everyday one for a name we do not know. */
export const siteThemeArtFor = (theme: string): SiteThemeArtSpec =>
  siteThemeArt[theme as SiteThemeName] ?? siteThemeArt.default;
