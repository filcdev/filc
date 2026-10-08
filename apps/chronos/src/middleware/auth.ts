import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ChronosContext } from '#_types/globals';
import { base } from '#orpc';
import { auth } from '#utils/authentication';
import { rbac, userHasPermission } from '#utils/authorization';
import { env } from '#utils/environment';
import { setSentryUser } from '#utils/telemetry';

const SIGNATURE_LENGTH = 64; // SHA-256 hex digest

/**
 * Verify the signed anonymous-id cookie without minting a new one: a client
 * that never got one falls back to IP-only rate limiting.
 */
function verifyAnonymousId(cookieValue: string): string | null {
  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex === -1) {
    return null;
  }

  const id = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);
  if (sig.length !== SIGNATURE_LENGTH) {
    return null;
  }

  const expected = createHmac('sha256', env.authSecret)
    .update(id)
    .digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length) {
    return null;
  }
  if (!timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  return id;
}

function readCookie(headers: Headers, name: string): string | null {
  return (
    headers
      .get('Cookie')
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`))
      ?.split('=')
      .slice(1)
      .join('=') ?? null // handle values containing '='
  );
}

/**
 * Resolve who is calling, once per request, before any procedure runs: a
 * better-auth session, or an anonymous id from the signed rate-limit cookie.
 * Also seeds Sentry's user context.
 *
 * API keys are not handled here. The `@better-auth/api-key` plugin is
 * registered with `enableSessionForAPIKeys`, so a valid key in the request
 * headers makes `getSession` above answer with a session for the key's owner —
 * one validation per request, and the key's own rate limit is applied by the
 * plugin. That also means the session is a real session row's shape, so the
 * guards below need no special case.
 */
export async function resolveCaller(
  headers: Headers
): Promise<Pick<ChronosContext, 'anonymousId' | 'session' | 'user'>> {
  // The api-key plugin *throws* (`Invalid API key.`, `API Key is disabled`)
  // rather than answering null when a key is present but unusable, and this
  // runs before every procedure — an uncaught throw here would turn any
  // request carrying a stale key into a 500. A key that fails to resolve is
  // simply not a caller, so the request continues as anonymous and the route's
  // own guard decides.
  const session = await auth.api.getSession({ headers }).catch(() => null);

  if (session) {
    setSentryUser(session.session, session.user);
    return { anonymousId: null, session: session.session, user: session.user };
  }

  setSentryUser(null);

  const cookie = readCookie(headers, env.rateLimitCookieName);
  return {
    anonymousId: cookie ? verifyAnonymousId(cookie) : null,
    session: null,
    user: null,
  };
}

/**
 * Guard for endpoints that only need a caller. Narrows the context so handler
 * bodies can read `context.session`/`context.user` without re-checking.
 */
export const requireAuthentication = base.middleware(
  ({ context, errors, next }) => {
    if (!context.session) {
      throw errors.UNAUTHORIZED({ message: 'Unauthorized' });
    }

    return next({
      context: { session: context.session, user: context.user },
    });
  }
);

/** Guard for endpoints gated on a permission string from `@filcdev/api/permissions`. */
export const requireAuthorization = (permission: string) => {
  rbac.registerPermission(permission);
  return base.middleware(async ({ context, errors, next }) => {
    if (!context.session) {
      throw errors.UNAUTHORIZED({ message: 'Unauthorized' });
    }

    if (!(await userHasPermission(context.session.userId, permission))) {
      throw errors.FORBIDDEN({ message: 'Forbidden' });
    }

    return next({
      context: { session: context.session, user: context.user },
    });
  });
};
