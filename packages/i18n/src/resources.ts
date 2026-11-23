import en from './locales/en/notifications.json' with { type: 'json' };
import hu from './locales/hu/notifications.json' with { type: 'json' };

/**
 * The notification and mail copy, keyed by locale. Both locales carry the same
 * `notifications` namespace; `en` is the type source, so a key that does not
 * exist (or a typo at a call site) is a `tsc` error. The parity test guards the
 * other direction: `hu` must carry every key `en` does.
 */
export const resources = {
  en: { notifications: en },
  hu: { notifications: hu },
} as const;

/** The languages every notification and mail template is written in. */
export type Locale = 'en' | 'hu';

declare module 'i18next' {
  // Module augmentation merges an interface; a type alias cannot.
  // biome-ignore lint/style/useConsistentTypeDefinitions: declaration merging needs an interface
  interface CustomTypeOptions {
    defaultNS: 'notifications';
    resources: { notifications: typeof en };
  }
}
