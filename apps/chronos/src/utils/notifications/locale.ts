import { type Locale, normalizeLocale } from '@filcdev/i18n';

/** The languages the notification emails and their chrome are written in. */
export type MailLocale = Locale;

/**
 * The language a stored preference resolves to for mail. The column is free
 * text — `en-GB`, an empty string, a code we do not translate — while the
 * templates and their chrome only exist in English and Hungarian, so the
 * BCP-47 primary tag decides and anything that is not English falls back to
 * Hungarian, the column's default.
 */
export function mailLocale(locale?: string | null): MailLocale {
  return normalizeLocale(locale ?? undefined);
}
