import type { AuthSession } from '@filcdev/auth';
import { createIsomorphicFn } from '@tanstack/react-start';
import {
  getCookie,
  getRequestHeaders,
  getRequestUrl,
} from '@tanstack/react-start/server';

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
 * Returns `null` where there is no request to read — outside a server render,
 * such as during the build.
 */
export const requestOrigin = () =>
  createIsomorphicFn()
    .server(() => {
      try {
        // `xForwardedHost` is off by default in the accessor, and the host is
        // the half that matters here: behind the platform proxy it is the
        // public origin, while the request object still carries the internal
        // one. `null` outside a request — during the build, say.
        return getRequestUrl({ xForwardedHost: true, xForwardedProto: true })
          .origin;
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
      const origin = requestOrigin();
      if (!origin) {
        return null;
      }

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
