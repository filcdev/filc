import type { AuthSession } from '@filcdev/auth';
import { createIsomorphicFn } from '@tanstack/react-start';
import {
  getCookie,
  getRequestHeaders,
  getRequestUrl,
} from '@tanstack/react-start/server';

/**
 * Absolute origin for a server render whose own origin could not be read.
 *
 * A relative origin is fatal for the callers below — oRPC builds a `URL` from
 * it, and the browser constructor rejects a relative one outright. The
 * development server is exactly that case: `getRequestUrl` answers nothing
 * there, so a server render has no origin of its own to use. Development points
 * straight at Chronos, which is also where the Vite proxy sends `/api`; behind
 * the platform proxy the request origin is always available and this is unused.
 */
export const fallbackApiOrigin =
  import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:3001';

/**
 * The origin the request being rendered came in on, e.g.
 * `https://filc.petrik.hu`.
 *
 * `getRequestUrl()` is the accessor for this rather than `new
 * URL(getRequest().url)`: it returns a `URL` already, and it resolves the
 * origin from `x-forwarded-host` / `x-forwarded-proto` when they are present.
 * Behind the platform proxy the request object still carries the *internal*
 * origin, so parsing it would send a server render's API calls back to
 * localhost instead of out to Chronos.
 *
 * Returns `null` where there is no request origin to read — the development
 * server and the build both qualify — so callers use `fallbackApiOrigin`.
 */
export const requestOrigin = () =>
  createIsomorphicFn()
    .server(() => {
      try {
        return getRequestUrl({
          xForwardedHost: true,
          xForwardedProto: true,
        }).origin;
      } catch {
        return null;
      }
    })
    .client(() => null)();

/** The language the browser asked for, resolved once per request. */
export const fetchLanguage = () =>
  createIsomorphicFn()
    .server(() => getCookie('filc.language') ?? 'hu')
    .client(() => 'hu')();

/**
 * The signed-in session of the request being rendered, or `null`.
 *
 * better-auth's client only fetches a session from a mounted atom, which never
 * happens while server-rendering — a server render would always look signed
 * out — so the session is read here once, with the incoming cookie, and handed
 * to the tree by the root route.
 */
export const fetchSession = (): Promise<AuthSession | null> =>
  createIsomorphicFn()
    .server(async () => {
      // Without an origin to read — the development server — the read used to
      // bail out, which left every server render looking signed out and sent the
      // browser's guard to /auth/login on the next refresh.
      const origin = requestOrigin() ?? fallbackApiOrigin;

      try {
        const response = await fetch(`${origin}/api/auth/get-session`, {
          headers: getRequestHeaders(),
        });
        // better-auth answers 200 with nulls when nobody is signed in; anything
        // else means the session is unknown, which is the signed-out variant too.
        return response.ok ? response.json() : null;
      } catch {
        // This runs in the root route's `beforeLoad`, so a lookup that throws
        // fails the whole render and leaves the browser to redo it. An
        // unreachable or slow auth endpoint is a signed-out render, not a
        // broken page.
        return null;
      }
    })
    .client(async () => null)();
