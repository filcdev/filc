import type { auth } from '#utils/authentication';

/**
 * Everything the transport knows before a procedure runs, built once per
 * request in `src/index.ts` and handed to both oRPC handlers.
 */
export type ChronosContext = {
  anonymousId: string | null;
  clientIp: string;
  /**
   * Minted per request in `src/index.ts` and echoed back on the response as
   * `x-request-id`, so a client (or a bug report) can name the exact request
   * it is talking about. Every log line the transport emits carries it.
   */
  requestId: string;
  reqHeaders: Headers;
  /** Injected by `ResponseHeadersPlugin`; a procedure can add to the response. */
  resHeaders?: Headers;
  session: (typeof auth.$Infer.Session)['session'] | null;
  user: (typeof auth.$Infer.Session)['user'] | null;
};
