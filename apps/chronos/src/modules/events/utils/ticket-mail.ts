import { formatMailDateWithWeekday } from '@filcdev/i18n';
import { renderEmail } from '@filcdev/mail';
import { getLogger } from '@logtape/logtape';
import { captureException } from '@sentry/bun';
import QRCode from 'qrcode';
import { env } from '#utils/environment';
import {
  type RawEmail,
  type SendEmailResult,
  sendRawEmail,
} from '#utils/notifications/providers/smtp';

const logger = getLogger(['chronos', 'events', 'tickets']);

/** The mail's own branding; the ticket is not a notification, so it carries none. */
const branding = { appName: 'Filc', appUrl: env.baseUrl };

/** One ticket's facts, as the handler read them from the committed rows. */
export type TicketFacts = {
  /** The ticket id: the QR payload and the code the visitor shows. */
  code: string;
  /** Where the ticket goes: the guest's address or the account's. */
  email: string;
  eventId: string;
  eventStartsAt: Date;
  eventTitle: string;
  /** The recipient's language; anything unknown falls back to Hungarian. */
  locale?: string | null;
  /** Identifies the registration in the log; the code and the address do not. */
  registrationId?: string;
  /** Joins the mail's lines to the request that triggered it. */
  requestId?: string;
  visitorName: string;
};

/**
 * What a caller may substitute for the QR renderer and the transport. Tests use
 * it to render and to assert the sent message without the network.
 */
export type TicketMailDeps = {
  qr?: (payload: string) => Promise<string>;
  send?: (message: RawEmail) => Promise<SendEmailResult>;
};

/** The page the QR and the email link point at. */
export const ticketUrl = (code: string): string =>
  `${env.baseUrl}/tickets/${code}`;

/** An inline PNG, so the mail is one self-contained message. */
const qrDataUri = (payload: string): Promise<string> =>
  QRCode.toDataURL(payload, { margin: 1, width: 440 });

/**
 * Build the ticket mail without sending it. Separate from the send so a test
 * can assert the recipient, subject and body the transport would receive.
 */
export const buildTicketEmail = async (
  facts: TicketFacts,
  deps: TicketMailDeps = {}
): Promise<RawEmail> => {
  const locale = facts.locale === 'en' ? 'en' : 'hu';
  const url = ticketUrl(facts.code);
  const { html, subject, text } = await renderEmail(
    'eventTicket',
    {
      code: facts.code,
      eventDate: formatMailDateWithWeekday(facts.eventStartsAt, locale),
      eventTitle: facts.eventTitle,
      locale,
      qrDataUri: await (deps.qr ?? qrDataUri)(facts.code),
      ticketUrl: url,
      visitorName: facts.visitorName,
    },
    branding
  );

  logger.debug('ticket email rendered', {
    bytes: html.length,
    eventId: facts.eventId,
    registrationId: facts.registrationId,
    requestId: facts.requestId,
    subject,
  });

  return { html, subject, text, to: facts.email };
};

/**
 * Render and send one ticket. A failure is logged and reported, never thrown:
 * the registration it belongs to has already committed and must stay.
 *
 * The ticket id is the QR payload and the address is the visitor's, so neither
 * is ever logged: the ids below are what a log reader gets, and the row holds
 * the rest.
 */
export const sendTicket = async (
  facts: TicketFacts,
  deps: TicketMailDeps = {}
): Promise<SendEmailResult> => {
  try {
    const message = await buildTicketEmail(facts, deps);
    const result = await (deps.send ?? sendRawEmail)(message);
    if (!result.ok) {
      logger.error('ticket email was not delivered', {
        eventId: facts.eventId,
        registrationId: facts.registrationId,
        requestId: facts.requestId,
        skipped: result.skipped === true,
      });
      // A sent-but-lost ticket means a visitor at the door with no QR; a
      // skipped one is a dev/test setup with no transport, not an incident.
      if (!result.skipped) {
        captureException(new Error('Ticket email was not delivered'), {
          extra: {
            eventId: facts.eventId,
            registrationId: facts.registrationId,
            requestId: facts.requestId,
          },
          tags: { feature: 'events', operation: 'ticket-mail' },
        });
      }
    }
    return result;
  } catch (error) {
    logger.error('failed to build or send the ticket email', {
      error,
      eventId: facts.eventId,
      registrationId: facts.registrationId,
      requestId: facts.requestId,
    });
    captureException(error);
    return { ok: false };
  }
};
