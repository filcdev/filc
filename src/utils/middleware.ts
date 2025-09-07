import { createMiddleware } from 'hono/factory';
import { StatusCodes } from 'http-status-codes';
import { auth } from '~/utils/authentication';
import { userHasPermission } from '~/utils/authorization';
import type { authenticatedContext, honoContext } from '~/utils/globals';

export const authenticationMiddleware = createMiddleware<honoContext>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      c.set('user', null);
      c.set('session', null);
      return next();
    }

    c.set('user', session.user);
    c.set('session', session.session);
    return next();
  }
);

export const requireAuthentication = createMiddleware<authenticatedContext>(
  async (c, next) => {
    if (!c.var.session) {
      return c.json({ error: 'Unauthorized' }, StatusCodes.UNAUTHORIZED);
    }

    await next();
  }
);

export const requireAuthorization = (permission: string) =>
  createMiddleware<authenticatedContext>(async (c, next) => {
    if (!(await userHasPermission(c.var.session.userId, permission))) {
      return c.json({ error: 'Forbidden' }, StatusCodes.FORBIDDEN);
    }

    await next();
  });
