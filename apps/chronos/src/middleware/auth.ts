import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ChronosContext } from '#_types/globals';
import { base } from '#orpc';
import { extractApiKey, validateApiKey } from '#utils/api-keys';
import { auth } from '#utils/authentication';
import { rbac, userHasPermission } from '#utils/authorization';
import { env } from '#utils/environment';
import { setSentryUser } from '#utils/telemetry';

type Session = typeof auth.$Infer.Session;

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
 * better-auth session, an API key (Bearer / `X-API-Key`), or an anonymous id
 * from the signed rate-limit cookie. Also seeds Sentry's user context.
 */
export async function resolveCaller(
  headers: Headers
): Promise<Pick<ChronosContext, 'anonymousId' | 'session' | 'user'>> {
  const session = await auth.api.getSession({ headers });

  if (session) {
    setSentryUser(session.session, session.user);
    return { anonymousId: null, session: session.session, user: session.user };
  }

  // Fall back to API key authentication (Bearer token or X-API-Key header).
  const rawKey = extractApiKey(headers);
  if (rawKey) {
    const apiUser = await validateApiKey(rawKey);
    if (apiUser) {
      setSentryUser({ userId: apiUser.id } as never, apiUser as never);
      // API keys are not tied to a browser session, but downstream guards only
      // need `session.userId`, so synthesize a minimal session object.
      return {
        anonymousId: null,
        session: { userId: apiUser.id } as Session['session'],
        user: apiUser as Session['user'],
      };
    }
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
