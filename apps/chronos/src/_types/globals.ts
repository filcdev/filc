import type { auth } from '#utils/authentication';

/**
 * Everything the transport knows before a procedure runs, built once per
 * request in `src/index.ts` and handed to both oRPC handlers.
 */
export type ChronosContext = {
  anonymousId: string | null;
  clientIp: string;
  reqHeaders: Headers;
  /** Injected by `ResponseHeadersPlugin`; a procedure can add to the response. */
  resHeaders?: Headers;
  session: (typeof auth.$Infer.Session)['session'] | null;
  user: (typeof auth.$Infer.Session)['user'] | null;
};
