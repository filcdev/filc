import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedContext, Context } from '#_types/globals';
import { extractApiKey, validateApiKey } from '#utils/api-keys';
import { auth } from '#utils/authentication';
import { rbac, userHasPermission } from '#utils/authorization';
import { setSentryUser } from '#utils/telemetry';

type Session = typeof auth.$Infer.Session;

export const authenticationMiddleware = createMiddleware<Context>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (session) {
      c.set('user', session.user);
      c.set('session', session.session);
      setSentryUser(session.session, session.user);
      return next();
    }

    // Fall back to API key authentication (Bearer token or X-API-Key header).
    const rawKey = extractApiKey(c.req.raw.headers);
    if (rawKey) {
      const apiUser = await validateApiKey(rawKey);
      if (apiUser) {
        c.set('user', apiUser as Session['user']);
        // API keys are not tied to a browser session, but downstream
        // middleware only needs `session.userId`, so synthesize a minimal
        // session object carrying the user id.
        c.set('session', { userId: apiUser.id } as Session['session']);
        setSentryUser({ userId: apiUser.id } as never, apiUser as never);
        return next();
      }
    }

    c.set('user', null);
    c.set('session', null);
    setSentryUser(null);
    return next();
  }
);

export const requireAuthentication = createMiddleware<AuthenticatedContext>(
  async (c, next) => {
    if (!c.var.session) {
      throw new HTTPException(StatusCodes.UNAUTHORIZED, {
        message: 'Unauthorized',
      });
    }

    await next();
  }
);

export const requireAuthorization = (permission: string) => {
  rbac.registerPermission(permission);
  return createMiddleware<AuthenticatedContext>(async (c, next) => {
    if (!c.var.session) {
      throw new HTTPException(StatusCodes.UNAUTHORIZED, {
        message: 'Unauthorized',
      });
    }

    if (!(await userHasPermission(c.var.session.userId, permission))) {
      throw new HTTPException(StatusCodes.FORBIDDEN, {
        message: 'Forbidden',
      });
    }

    await next();
  });
};
