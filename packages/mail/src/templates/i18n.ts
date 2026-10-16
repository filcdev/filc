import type { Locale } from './types';

export const emailCopy = {
  en: {
    autoMessage: 'This is an automated message from Filc.',
    greeting: 'Dear Filc user,',
    greetingNamed: 'Dear {name},',
    unsubscribeLabel: 'Unsubscribe from notifications',
    viewLabel: 'View in Filc',
  },
  hu: {
    autoMessage: 'Ez az email a Filc rendszer automatikus üzenete.',
    greeting: 'Kedves Filc felhasználó!',
    greetingNamed: 'Kedves {name}!',
    unsubscribeLabel: 'Leiratkozás az értesítésekről',
    viewLabel: 'Megtekintés a Filcben',
  },
} as const;

export const greetingFor = (
  locale: Locale,
  recipientName?: string | null
): string => {
  const name = recipientName?.trim();
  return name
    ? emailCopy[locale].greetingNamed.replace('{name}', name)
    : emailCopy[locale].greeting;
};
