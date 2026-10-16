import { createTransport } from 'nodemailer';
import { z } from 'zod';
import { renderNotification } from './templates/notification';
import type {
  Branding,
  NotificationEmailData,
  RenderedEmail,
} from './templates/types';

export type {
  Branding,
  Locale,
  NotificationEmailData,
  RenderedEmail,
} from './templates/types';

export type OutboundMessage = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

export type AccessToken = {
  /** Unix ms when the token stops being valid; omitted renews only after it is rejected. */
  expires?: number;
  token: string;
};

export type EntraCredentials = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
};

export type SmtpAuth =
  | { pass?: string; type: 'basic'; user: string }
  /** Microsoft 365 / Outlook.com: SASL XOAUTH2 with an Entra-minted bearer token. */
  | { entra: EntraCredentials; type: 'oauth2'; user: string };

export type SmtpConfig = {
  auth?: SmtpAuth;
  from: string;
  host: string;
  port: number;
  secure: boolean;
};

export type MailTransport = {
  send: (message: OutboundMessage) => Promise<void>;
};

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
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.to,
      });
    },
  };
};

const MICROSOFT_AUTHORITY = 'https://login.microsoftonline.com';
/** The fixed Exchange Online scope an app-only token must be minted for. */
const OUTLOOK_SCOPE = 'https://outlook.office365.com/.default';

const entraTokenSchema = z.object({
  access_token: z.string().optional(),
  error: z.string().optional(),
  expires_in: z.number().optional(),
});

/**
 * Mints a bearer token for SASL XOAUTH2 via the Entra client-credentials grant.
 * `SMTP.SendAsApp` (Office 365 Exchange Online, application permission) plus a
 * service principal registered in Exchange and granted on the mailbox are what
 * make the resulting token acceptable to Exchange Online.
 */
export const fetchEntraAccessToken = async (
  credentials: EntraCredentials
): Promise<AccessToken> => {
  const response = await fetch(
    `${MICROSOFT_AUTHORITY}/${credentials.tenantId}/oauth2/v2.0/token`,
    {
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: 'client_credentials',
        scope: OUTLOOK_SCOPE,
      }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    }
  );
  const payload = entraTokenSchema.parse(await response.json());
  if (response.ok && payload.access_token) {
    return {
      expires: payload.expires_in
        ? Date.now() + payload.expires_in * 1000
        : undefined,
      token: payload.access_token,
    };
  }
  throw new Error(
    `Entra token request failed (${response.status}): ${payload.error ?? response.statusText}`
  );
};

export type TemplateData = {
  notification: NotificationEmailData;
};

export type TemplateName = keyof TemplateData;

type TemplateRenderer<Name extends TemplateName> = (
  data: TemplateData[Name],
  branding: Branding
) => Promise<RenderedEmail>;

const renderers: { [Name in TemplateName]: TemplateRenderer<Name> } = {
  notification: renderNotification,
};

export const renderEmail = <Name extends TemplateName>(
  name: Name,
  data: TemplateData[Name],
  branding: Branding
): Promise<RenderedEmail> => renderers[name](data, branding);
