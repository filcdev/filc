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
  expires_in: z.coerce.number().optional(),
});

const entraErrorSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
});

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
    // An error body is not guaranteed to be JSON (a proxy page, an empty
    // body); the status alone still has to reach the caller.
    const json = await response.json().catch(() => undefined);
    const parsed = entraErrorSchema.safeParse(json);
    const detail = [
      parsed.success ? parsed.data.error : undefined,
      parsed.success ? parsed.data.error_description : undefined,
    ]
      .filter(Boolean)
      .join(': ');
    throw new Error(
      `Entra token request failed (${response.status}): ${detail || response.statusText || 'no detail'}`
    );
  }

  const payload = entraTokenSchema.parse(await response.json());
  if (!payload.access_token) {
    throw new Error(
      `Entra token request failed (${response.status}): no access_token in the response`
    );
  }
  return {
    expires: payload.expires_in
      ? Date.now() + payload.expires_in * 1000
      : undefined,
    token: payload.access_token,
  };
};
