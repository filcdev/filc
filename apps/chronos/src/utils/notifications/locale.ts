/** The languages the notification emails and their chrome are written in. */
export type MailLocale = 'en' | 'hu';

/**
 * The language a stored preference resolves to for mail. The column is free
 * text — `en-GB`, an empty string, a code we do not translate — while the
 * templates and their chrome only exist in English and Hungarian, so the
 * BCP-47 primary tag decides and anything that is not English falls back to
 * Hungarian, the column's default.
 */
export function mailLocale(locale?: string | null): MailLocale {
  return (locale ?? '').trim().toLowerCase().split('-')[0] === 'en'
    ? 'en'
    : 'hu';
}

/**
 * Whether a notification should be written in Hungarian. Every module that
 * owns a notification branches on this, so it lives here rather than being
 * copied per feature. Shares the mail rule, so the content builders and the
 * email wrapper can never disagree about a locale.
 */
export function isHungarianLocale(locale: string): boolean {
  return mailLocale(locale) === 'hu';
}
