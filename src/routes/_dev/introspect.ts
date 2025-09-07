import { db } from '~/database';
import { timetableSchema } from '~/database/schema/timetable';
import { pingFactory } from '~/routes/ping/_factory';
import { getUserPermissions } from '~/utils/authorization';
import { requireAuthentication } from '~/utils/middleware';

export const introspect = pingFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const tables = Object.entries(timetableSchema);
    const data = tables.map(([name, table]) =>
      db
        .select()
        .from(table)
        .then((rows) => ({ name, rows }))
    );
    const results = await Promise.all(data);

    return c.json({
      timetableData: results,
      user: {
        ...c.var.user,
        permissions: await getUserPermissions(c.var.session.userId),
      },
      session: c.var.session,
    });
  }
);
