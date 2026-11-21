import type { Locale as I18nLocale } from '@filcdev/i18n';

/** The languages the notification emails are written in. */
export type Locale = I18nLocale;

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

/**
 * The guest ticket. Every string the mail shows is built by the template from
 * the i18n catalogue; the caller supplies the facts and the QR image, so the
 * mail package needs no QR library and no database.
 */
export type EventTicketEmailData = {
  /** The ticket id, which is also the QR payload; shown as text as well. */
  code: string;
  /** Already formatted in the recipient's locale by the caller. */
  eventDate: string;
  eventTitle: string;
  locale: Locale;
  /** An inline `data:image/png;base64,...` QR of the ticket id. */
  qrDataUri: string;
  /** The public ticket page, so an image-blocking client still gets in. */
  ticketUrl: string;
  visitorName: string;
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
  /** Authenticated page where the recipient can change their own channels. */
  manageUrl?: string;
};
