export type Locale = 'en' | 'hu';

/** Accent identity of a notification email. */
export type EmailAccent =
  | 'teal'
  | 'indigo'
  | 'amber'
  | 'violet'
  | 'blue'
  | 'slate'
  | 'rose'
  | 'orange';

/** One label/value row in the optional details block of a notification email. */
export type EmailDetail = { label: string; value: string };

export type Branding = {
  appName: string;
  appUrl: string;
};

export type RenderedEmail = {
  html: string;
  subject: string;
  text: string;
};

export type NotificationEmailData = {
  /** Accent identity of the email; defaults to `teal`. */
  accent?: EmailAccent;
  content: string;
  details?: EmailDetail[];
  /** Short, already-localized pill values rendered as chips in the hero. */
  highlights?: string[];
  locale: Locale;
  recipientName?: string | null;
  title: string;
  /** Localized notification-category label; the caller owns the type → label map. */
  typeLabel: string;
  /** Absent only in the dev-only styling preview. */
  unsubscribeUrl?: string;
};
