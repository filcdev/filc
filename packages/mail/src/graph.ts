import MailComposer from 'nodemailer/lib/mail-composer';
import { z } from 'zod';
import { fetchEntraAccessToken, GRAPH_SCOPE } from './entra';
import type {
  AccessToken,
  EntraCredentials,
  MailTransport,
  OutboundMessage,
} from './types';

const GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0';
/** Per-attempt budget: the 401 retry is a second attempt with its own budget. */
const SEND_TIMEOUT_MS = 30_000;
/** Renew the token this long before Entra's stated expiry. */
const TOKEN_EXPIRY_SKEW_MS = 60_000;
/** Used when a 429 carries no usable `Retry-After` header. */
const DEFAULT_RETRY_AFTER_MS = 1000;
/** A longer wait than this is a misconfigured proxy header, not a hint. */
const MAX_RETRY_AFTER_MS = 60_000;

export type GraphConfig = {
  entra: EntraCredentials;
  /** The MIME `From` value, name and address included. */
  from: string;
  /** The mailbox Graph posts to, and therefore the account the mail leaves as. */
  mailbox: string;
};

/** A failed Graph `sendMail` call, carrying what a caller can act on. */
export class GraphMailError extends Error {
  /** Set on a 429, from `Retry-After`; the caller waits at least this long. */
  readonly retryAfterMs?: number;
  readonly status: number;

  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = 'GraphMailError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const graphErrorSchema = z.object({
  error: z
    .object({ code: z.string().optional(), message: z.string().optional() })
    .optional(),
});

/** Compiles the message to base64-encoded MIME, the shape `/sendMail` wants. */
const compileMessage = async (
  from: string,
  message: OutboundMessage
): Promise<string> => {
  const mime = await new MailComposer({
    from,
    headers: message.headers,
    html: message.html,
    subject: message.subject,
    text: message.text,
    to: message.to,
  })
    .compile()
    .build();
  return mime.toString('base64');
};

const clampRetryAfterMs = (value: number): number =>
  Math.min(Math.max(value, 0), MAX_RETRY_AFTER_MS);

/**
 * `Retry-After` carries either delay seconds or an HTTP date; both forms are
 * accepted. A missing or unparseable header falls back to the default, while
 * an empty or zero value parses as 0 — callers treat anything `> 0` as a hint
 * and otherwise use their own backoff.
 */
const retryAfterMsOf = (response: Response): number => {
  const header = response.headers.get('retry-after');
  if (header === null) {
    return DEFAULT_RETRY_AFTER_MS;
  }

  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return clampRetryAfterMs(seconds * 1000);
  }

  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    return clampRetryAfterMs(date - Date.now());
  }

  return DEFAULT_RETRY_AFTER_MS;
};

/**
 * Builds the error for a non-2xx answer, surfacing Graph's own `error.code`
 * (`ErrorSendAsDenied`, `ErrorInvalidRecipients`, …) and a 429's `Retry-After`.
 */
const graphError = async (response: Response): Promise<GraphMailError> => {
  if (response.status === 429) {
    return new GraphMailError(
      'Graph sendMail was rate limited (429)',
      response.status,
      retryAfterMsOf(response)
    );
  }

  // An error body is not guaranteed to be JSON (a proxy page, an empty body),
  // and the HTTP status alone is still worth reporting.
  const json = await response.json().catch(() => undefined);
  const parsed = graphErrorSchema.safeParse(json);
  const error = parsed.success ? parsed.data.error : undefined;
  const detail =
    [error?.code, error?.message].filter(Boolean).join(': ') || 'no detail';
  const fullDetail = [detail, response.statusText].filter(Boolean).join(': ');
  return new GraphMailError(
    `Graph sendMail failed (${response.status}): ${fullDetail}`,
    response.status
  );
};

/**
 * Sends through Microsoft Graph app-only `Mail.Send`, as the configured
 * mailbox. The token is cached in the closure and re-minted on expiry or on a
 * 401, so a long-lived process does not mint one per message, and concurrent
 * sends share a single in-flight mint.
 */
export const createGraphTransport = (config: GraphConfig): MailTransport => {
  const { entra, mailbox } = config;
  const sendMailUrl = `${GRAPH_ENDPOINT}/users/${encodeURIComponent(mailbox)}/sendMail`;

  let cached: AccessToken | null = null;
  let minting: Promise<AccessToken> | null = null;

  const isFresh = (token: AccessToken): boolean =>
    token.expires === undefined ||
    token.expires - TOKEN_EXPIRY_SKEW_MS > Date.now();

  const mint = (): Promise<AccessToken> => {
    minting ??= fetchEntraAccessToken(entra, GRAPH_SCOPE).finally(() => {
      minting = null;
    });
    return minting;
  };

  const getToken = async (force = false): Promise<string> => {
    if (!force && cached && isFresh(cached)) {
      return cached.token;
    }
    cached = await mint();
    return cached.token;
  };

  const post = (token: string, body: string): Promise<Response> =>
    fetch(sendMailUrl, {
      body,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'text/plain',
      },
      method: 'POST',
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

  return {
    send: async (message: OutboundMessage): Promise<void> => {
      const body = await compileMessage(config.from, message);

      let response = await post(await getToken(), body);
      if (response.status === 401) {
        response = await post(await getToken(true), body);
      }
      if (response.ok) {
        return;
      }
      throw await graphError(response);
    },
  };
};
