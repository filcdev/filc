/**
 * The contract between the design system and an app that lets its visitors
 * pick a palette: an attribute on an element, read by the selectors in
 * `../styles/schemes.css`.
 *
 * A scheme sits under a seasonal skin in precedence (both are `[attr]:not(.dark)`
 * blocks, and `themes.css` is imported last), so a visitor who chose Nord still
 * gets the December colours — unless the app leaves `data-site-theme` at
 * `default` because they turned that off.
 */
export const COLOR_SCHEME_ATTRIBUTE = 'data-color-scheme';

/** The everyday palette from `../styles/globals.css`; it has no block of its own. */
export const DEFAULT_COLOR_SCHEME = 'default';

/**
 * Paint `scheme` onto the document root, or onto `element` — a settings picker
 * previews a palette by passing its own node instead.
 *
 * A no-op while there is no `document`: a server render already carries the
 * attribute in its markup and never needs this.
 */
export function applyColorScheme(scheme: string, element?: HTMLElement): void {
  const target =
    element ??
    (typeof document === 'undefined' ? undefined : document.documentElement);

  target?.setAttribute(COLOR_SCHEME_ATTRIBUTE, scheme);
}
