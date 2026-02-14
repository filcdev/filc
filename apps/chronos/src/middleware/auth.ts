import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedContext, Context } from '#_types/globals';
import { auth } from '#utils/authentication';
import { rbac, userHasPermission } from '#utils/authorization';
import { setSentryUser } from '#utils/telemetry';

export const authenticationMiddleware = createMiddleware<Context>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      c.set('user', null);
      c.set('session', null);
      setSentryUser(null);
      return next();
    }

    c.set('user', session.user);
    c.set('session', session.session);
    setSentryUser(session.session, session.user);
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
