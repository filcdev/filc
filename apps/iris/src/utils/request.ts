import type { AuthSession } from '@filcdev/auth';
import { createIsomorphicFn } from '@tanstack/react-start';
import {
  getCookie,
  getRequest,
  getRequestHeaders,
} from '@tanstack/react-start/server';

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
      const response = await fetch(
        `${new URL(getRequest().url).origin}/api/auth/get-session`,
        { headers: getRequestHeaders() }
      );
      // better-auth answers 200 with nulls when nobody is signed in; anything
      // else means the session is unknown, which is the signed-out variant too.
      return response.ok ? response.json() : null;
    })
    .client(async () => null)();
