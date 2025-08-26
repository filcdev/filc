import { createMiddleware } from 'hono/factory';
import { StatusCodes } from 'http-status-codes';
import { auth } from '~/utils/authentication';
import type { honoContext } from '~/utils/globals';

export const requireAuthentication = createMiddleware<honoContext>(
  async (c, next) => {
    if (!c.get('session')) {
      return c.json({ error: 'Unauthorized' }, StatusCodes.UNAUTHORIZED);
    }

    await next();
  }
);

export const requireAuthorization = (permission: Record<string, string[]>) =>
  createMiddleware<honoContext>(async (c, next) => {
    const session = c.get('session');
    if (!session) {
      return c.json({ error: 'Unauthorized' }, StatusCodes.UNAUTHORIZED);
    }

    if (
      !(await auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permission,
        },
      }))
    ) {
      return c.json({ error: 'Forbidden' }, StatusCodes.FORBIDDEN);
    }

    await next();
  });
