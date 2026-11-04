/**
 * The contract between the design system and an app that opts into the
 * seasonal skins: an attribute on an element, read by the selectors in
 * `../styles/themes.css`.
 *
 * The default skin is the everyday palette in `../styles/globals.css`, so an
 * app that has no theme of its own still renders a valid `data-site-theme`.
 */
export const SITE_THEME_ATTRIBUTE = 'data-site-theme';

/** The skin that means "no seasonal styling". */
export const DEFAULT_SITE_THEME = 'default';

/**
 * Paint `theme` onto the document root, or onto `element` — a picker previews
 * a skin by passing its own node instead.
 *
 * A no-op while there is no `document`: a server render already carries the
 * attribute in its markup and never needs this.
 */
export function applySiteTheme(theme: string, element?: HTMLElement): void {
  const target =
    element ??
    (typeof document === 'undefined' ? undefined : document.documentElement);

  target?.setAttribute(SITE_THEME_ATTRIBUTE, theme);
}
