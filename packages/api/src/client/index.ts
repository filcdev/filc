import type { Hono } from 'hono';
import { hc } from 'hono/client';
import type { ApiEnvelope } from '../envelope';
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
 * Parse a Chronos response: asserts HTTP success via the response object and
 * unwraps the `{ data, success }` envelope. Throws {@link ApiError} with the
 * structured failure details so callers can branch on `code`/`status`
 * instead of parsing message strings.
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

  const envelope = body as ApiEnvelope<T>;
  if (!envelope.success) {
    throw new ApiError('UNKNOWN', {
      details: envelope.cause ?? envelope.data,
      message:
        typeof envelope.error === 'string' ? envelope.error : 'Request failed',
      status: response.status,
    });
  }

  const payload = envelope.data as T;
  if (schema) {
    return schema.parse(payload);
  }
  return payload;
}
