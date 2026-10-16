import { apiKeyClient } from '@better-auth/api-key/client';
import type { ApiKey } from '@better-auth/api-key/types';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from 'react';
import type { AuthSession, FilcAuth } from './index';

/**
 * The browser auth client, shared by every app. It talks to the same
 * better-auth surface Chronos serves at `/api/auth/*`, relative to the app's
 * origin (iris proxies it in development).
 *
 * `apiKeyClient` mirrors the server's `@better-auth/api-key` plugin, which owns
 * the `/api/auth/api-key/*` endpoints. Those live outside the oRPC contract on
 * purpose (see AGENTS.md), so this plugin — not an oRPC router — is what types
 * `authClient.apiKey.create/list/update/delete`.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<FilcAuth>(), apiKeyClient()],
});

/**
 * One API key row as the *list* endpoint returns it.
 *
 * `list` strips the secret before answering, so this is the stored row minus
 * `key` — that field is populated only by `create`, which returns the raw
 * secret exactly once. Every stored-row field is carried over, `enabled` and
 * the timestamps included.
 */
export type ApiKeyRow = Omit<ApiKey, 'key'>;

export type { ApiKey } from '@better-auth/api-key/types';

/**
 * The session of the request being rendered, or `undefined` where nothing has
 * provided one (an app with no server render).
 *
 * better-auth's client only ever fetches the session from a mounted atom, and
 * that mount does not happen while server-rendering — a server render would
 * therefore always look signed out. An SSR app reads the session once per
 * request and hands it down here, so `useSession` answers for both sides.
 */
const AuthSessionContext = createContext<AuthSession | null | undefined>(
  undefined
);

export const AuthSessionProvider = ({
  children,
  session,
}: {
  children: ReactNode;
  session: AuthSession | null;
}) => createElement(AuthSessionContext, { value: session }, children);

/**
 * The signed-in session. better-auth's client can only type a custom session by
 * reading a *server instance*, which is what this package exists to keep out of
 * the apps, so the payload is declared in `./index` and asserted here — the one
 * place that knows the server's custom session adds `displayName` and
 * `permissions`. `apps/chronos/src/_types/auth.ts` keeps the claim honest.
 *
 * The browser's own atom wins as soon as it has an answer, so signing out is
 * still picked up; a server render, where the atom stays pending, reads the
 * session its app provided.
 */
export const useSession = () => {
  const provided = useContext(AuthSessionContext);
  const result = authClient.useSession();
  if (provided === undefined || !result.isPending) {
    return { ...result, data: result.data as AuthSession | null };
  }
  return { ...result, data: provided, isPending: false };
};

export type {
  AuthSession,
  AuthSession as Session,
  AuthUser,
  AuthUser as User,
} from './index';
