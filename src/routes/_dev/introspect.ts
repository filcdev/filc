import { pingFactory } from '~/routes/ping/_factory';
import { getUserPermissions } from '~/utils/authorization';
import { requireAuthentication } from '~/utils/middleware';

export const introspect = pingFactory.createHandlers(
  requireAuthentication,
  (c) => {
    return c.json({
      user: {
        ...c.var.user,
        permissions: getUserPermissions(c.var.session.userId),
      },
      session: c.var.session,
    });
  }
);
