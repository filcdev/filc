/**
 * Whether a notification should be written in Hungarian. Every module that
 * owns a notification branches on this, so it lives here rather than being
 * copied per feature. Matches on the BCP-47 prefix, so `hu-HU` counts too.
 */
export function isHungarianLocale(locale: string): boolean {
  return (locale.toLowerCase().split('-')[0] ?? locale) === 'hu';
}
