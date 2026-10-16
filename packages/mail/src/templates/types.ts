export type Locale = 'en' | 'hu';

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
  locale: Locale;
  recipientName?: string | null;
  title: string;
  /** Localized notification-category label; the caller owns the type → label map. */
  typeLabel: string;
  /** Absent only in the dev-only styling preview. */
  unsubscribeUrl?: string;
};
