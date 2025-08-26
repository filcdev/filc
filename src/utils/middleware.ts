import { createMiddleware } from 'hono/factory';
import { StatusCodes } from 'http-status-codes';
import { userHasPermission } from '~/utils/authorization';
import type { authenticatedContext } from '~/utils/globals';

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
