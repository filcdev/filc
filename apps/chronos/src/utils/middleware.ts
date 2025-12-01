import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { auth } from '#utils/authentication';
import { userHasPermission } from '#utils/authorization';
import type { AuthenticatedContext, Context } from '#utils/globals';

export const authenticationMiddleware = createMiddleware<Context>(
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

export const requireAuthorization = (permission: string) =>
  createMiddleware<AuthenticatedContext>(async (c, next) => {
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
