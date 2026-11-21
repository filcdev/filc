// biome-ignore-all lint/performance/noBarrelFile: this package's `exports` map
// points only at this file, so it is the one place the transports and the
// template surface can be reached from.
import { createTransport } from 'nodemailer';
import { fetchEntraAccessToken } from './entra';
import { assertSafeHeaders } from './headers';
import { renderEventTicket } from './templates/event-ticket';
import { renderNotification } from './templates/notification';
import type {
  Branding,
  EventTicketEmailData,
  NotificationEmailData,
  RenderedEmail,
} from './templates/types';
import type { MailTransport, OutboundMessage, SmtpConfig } from './types';

export { fetchEntraAccessToken, GRAPH_SCOPE, OUTLOOK_SCOPE } from './entra';
export type { GraphConfig } from './graph';
export { createGraphTransport, GraphMailError } from './graph';
export type {
  Branding,
  EmailAccent,
  EmailDetail,
  EventTicketEmailData,
  Locale,
  NotificationEmailData,
  RenderedEmail,
} from './templates/types';
export type {
  AccessToken,
  EntraCredentials,
  MailTransport,
  OutboundMessage,
  SmtpAuth,
  SmtpConfig,
} from './types';

export const createMailTransport = (config: SmtpConfig): MailTransport => {
  const { auth } = config;
  const transport = createTransport({
    auth:
      auth?.type === 'oauth2'
        ? {
            provisionCallback: (_user, _renew, callback) => {
              fetchEntraAccessToken(auth.entra).then(
                ({ expires, token }) => callback(null, token, expires),
                (error: unknown) =>
                  callback(
                    error instanceof Error ? error : new Error(String(error))
                  )
              );
            },
            type: 'OAuth2',
            user: auth.user,
          }
        : auth && { pass: auth.pass, user: auth.user },
    host: config.host,
    port: config.port,
    secure: config.secure,
  });
  return {
    send: async (message: OutboundMessage): Promise<void> => {
      await transport.sendMail({
        from: config.from,
        headers: assertSafeHeaders(message.headers),
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.to,
      });
    },
  };
};

export type TemplateData = {
  eventTicket: EventTicketEmailData;
  notification: NotificationEmailData;
};

export type TemplateName = keyof TemplateData;

type TemplateRenderer<Name extends TemplateName> = (
  data: TemplateData[Name],
  branding: Branding
) => Promise<RenderedEmail>;

const renderers: { [Name in TemplateName]: TemplateRenderer<Name> } = {
  eventTicket: renderEventTicket,
  notification: renderNotification,
};

export const renderEmail = <Name extends TemplateName>(
  name: Name,
  data: TemplateData[Name],
  branding: Branding
): Promise<RenderedEmail> => renderers[name](data, branding);
