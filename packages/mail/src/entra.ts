import { z } from 'zod';
import type { AccessToken, EntraCredentials } from './types';

const MICROSOFT_AUTHORITY = 'https://login.microsoftonline.com';
/** Per-request budget; a token mint is one attempt with no retry of its own. */
const TOKEN_REQUEST_TIMEOUT_MS = 30_000;
/** The fixed Exchange Online scope an app-only token must be minted for (SMTP XOAUTH2). */
export const OUTLOOK_SCOPE = 'https://outlook.office365.com/.default';
/** The app-only scope Microsoft Graph's `sendMail` accepts. */
export const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

const entraTokenSchema = z.object({
  access_token: z.string().optional(),
  /** Entra sends this as a string; a value that is not a number is dropped, not fatal. */
  expires_in: z.coerce.number().finite().optional().catch(undefined),
});

const entraErrorSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
});

/**
 * A failed token request, always framed the same way so the status and Entra's
 * own code reach the log line: a raw `ZodError` or `SyntaxError` from parsing
 * the body would name neither.
 */
const tokenError = (response: Response, detail: string): Error =>
  new Error(`Entra token request failed (${response.status}): ${detail}`);

/**
 * Reads the body as JSON without throwing: Entra answers with JSON, but a proxy
 * page or an empty body is possible and the HTTP status alone is still worth
 * reporting. An unreadable body reads as `undefined`.
 */
const readJson = async (response: Response): Promise<unknown> => {
  try {
    return JSON.parse(await response.text());
  } catch {
    return undefined;
  }
};

/**
 * Mints a bearer token via the Entra client-credentials grant. The scope picks
 * the API: Exchange Online for SASL XOAUTH2 (`SMTP.SendAsApp`), Microsoft Graph
 * for `sendMail` (`Mail.Send`) — both as application permissions with admin
 * consent, plus a service principal granted on the sending mailbox.
 */
export const fetchEntraAccessToken = async (
  credentials: EntraCredentials,
  scope = OUTLOOK_SCOPE
): Promise<AccessToken> => {
  const response = await fetch(
    `${MICROSOFT_AUTHORITY}/${encodeURIComponent(credentials.tenantId)}/oauth2/v2.0/token`,
    {
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: 'client_credentials',
        scope,
      }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    const parsed = entraErrorSchema.safeParse(await readJson(response));
    const error = parsed.success ? parsed.data : undefined;
    const detail =
      [error?.error, error?.error_description].filter(Boolean).join(': ') ||
      response.statusText ||
      'no detail';
    throw tokenError(response, detail);
  }

  const payload = entraTokenSchema.safeParse(await readJson(response));
  const accessToken = payload.success ? payload.data.access_token : undefined;
  if (!accessToken) {
    throw tokenError(response, 'no access_token in the response');
  }
  const expiresIn = payload.success ? payload.data.expires_in : undefined;
  return {
    expires: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    token: accessToken,
  };
};
