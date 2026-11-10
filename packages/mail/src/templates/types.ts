export type Locale = 'en' | 'hu';

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
  content: string;
  details?: EmailDetail[];
  locale: Locale;
  recipientName?: string | null;
  title: string;
  /** Localized notification-category label; the caller owns the type → label map. */
  typeLabel: string;
  /** Absent only in the dev-only styling preview. */
  unsubscribeUrl?: string;
};
