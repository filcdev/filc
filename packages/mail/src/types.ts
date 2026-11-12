/**
 * The transport surface shared by the SMTP and Microsoft Graph senders. Kept
 * apart from `index.ts` so a transport module can import it without reaching
 * back into the barrel that re-exports the transport.
 */

export type OutboundMessage = {
  /** Extra RFC 5322 headers, e.g. `List-Unsubscribe`. */
  headers?: Record<string, string>;
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
