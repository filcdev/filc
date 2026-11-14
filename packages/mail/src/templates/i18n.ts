import type { Locale } from './types';

export const emailCopy = {
  en: {
    autoMessage: 'This is an automated message from Filc.',
    greeting: 'Dear Filc user,',
    greetingNamed: 'Dear {name},',
    manageLabel: 'Manage your notifications',
    unsubscribeLabel: 'Unsubscribe from emails',
    viewLabel: 'View in Filc',
  },
  hu: {
    autoMessage: 'Ez az email a Filc rendszer automatikus üzenete.',
    greeting: 'Kedves Filc felhasználó!',
    greetingNamed: 'Kedves {name}!',
    manageLabel: 'Értesítések kezelése',
    unsubscribeLabel: 'Leiratkozás az e-mailekről',
    viewLabel: 'Megtekintés a Filcben',
  },
} as const;

type EmailCopy = (typeof emailCopy)[Locale];

const fallbackCopy: EmailCopy = emailCopy.en;

/**
 * Copy for a locale. `Locale` is a closed union, but a caller of this package
 * can pass a value it only knows at runtime, and an unknown locale has to
 * render English rather than dereference `undefined`.
 */
export const copyFor = (locale: Locale): EmailCopy =>
  emailCopy[locale] ?? fallbackCopy;

export const greetingFor = (
  locale: Locale,
  recipientName?: string | null
): string => {
  const copy = copyFor(locale);
  const name = recipientName?.trim();
  // The replacer is a function so `$&`, ``$` `` or `$'` in a name stay literal
  // text instead of being read as replacement patterns.
  return name
    ? copy.greetingNamed.replace('{name}', () => name)
    : copy.greeting;
};
