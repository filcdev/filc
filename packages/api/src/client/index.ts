import type { Hono } from 'hono';
import { hc } from 'hono/client';
import { errorEnvelopeSchema } from '../envelope';
import { ApiError } from '../errors';

export type ClientOptions = {
  /** Options forwarded to every `fetch` call (headers, credentials, ...). */
  init?: RequestInit;
};

/**
 * Create a typed Hono RPC client for a Chronos router. `T` is the router's
 * type (`typeof someRouter`), typically re-exported from
 * `@filcdev/chronos/types/hc`.
 */
// biome-ignore lint/suspicious/noExplicitAny: mirrors hono's own hc<T> constraint
export function createApiClient<T extends Hono<any, any, any>>(
  baseUrl: string,
  options?: ClientOptions
) {
  const init = options?.init;
  return hc<T>(
    baseUrl,
    init
      ? {
          fetch: (input: RequestInfo | URL, requestInit?: RequestInit) =>
            fetch(input, { ...init, ...requestInit }),
          init,
        }
      : {}
  );
}

type UnwrappableResponse = {
  json: () => Promise<unknown>;
  status: number;
};

/**
 * Parse a Chronos response and unwrap the `{ data, success }` envelope.
 * Throws {@link ApiError} with the structured failure details so callers can
 * branch on `code`/`status` instead of parsing message strings.
 *
 * When `schema` is provided the unwrapped payload is validated against it,
 * turning backend shape drift into a loud client-side failure.
 */
export async function unwrapResponse<T>(
  call:
    | Promise<{ response: UnwrappableResponse; json?: () => Promise<unknown> }>
    | UnwrappableResponse,
  schema?: { parse: (value: unknown) => T }
): Promise<T> {
  const res = await call;
  const response =
    'response' in res ? (res.response as UnwrappableResponse) : res;

  let body: unknown;
  try {
    body = await ('json' in res && typeof res.json === 'function'
      ? res.json()
      : response.json());
  } catch (error) {
    throw new ApiError('UNKNOWN', {
      cause: error,
      message: 'Failed to parse API response body',
      status: response.status,
    });
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'success' in body &&
    body.success === false
  ) {
    // Error envelopes are validated, not trusted: a malformed one still
    // produces an ApiError instead of a silent wrong-shape success.
    const parsed = errorEnvelopeSchema.safeParse(body);
    const code = parsed.success ? parsed.data.code : 'UNKNOWN';
    const message = parsed.success
      ? parsed.data.error
      : 'Malformed error response';
    const details = parsed.success ? parsed.data.cause : body;
    throw new ApiError(code, { details, message, status: response.status });
  }

  const payload =
    typeof body === 'object' && body !== null && 'data' in body
      ? body.data
      : undefined;

  return schema ? schema.parse(payload) : (payload as T);
}
