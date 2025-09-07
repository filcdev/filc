import { db } from '~/database';
import { lesson } from '~/database/schema/timetable';
import { pingFactory } from '~/routes/ping/_factory';
import { getUserPermissions } from '~/utils/authorization';
import { requireAuthentication } from '~/utils/middleware';

export const introspect = pingFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const lessons = db.select().from(lesson);

    return c.json({
      lessons,
      user: {
        ...c.var.user,
        permissions: await getUserPermissions(c.var.session.userId),
      },
      session: c.var.session,
    });
  }
);
