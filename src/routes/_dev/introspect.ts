import { db } from '~/database';
import { authenticationSchema } from '~/database/schema/authentication';
import { authorizationSchema } from '~/database/schema/authorization';
import { doorlockSchema } from '~/database/schema/doorlock';
import { featureFlagSchema } from '~/database/schema/feature-flag';
import { timetableSchema } from '~/database/schema/timetable';
import { pingFactory } from '~/routes/ping/_factory';
import { getUserPermissions } from '~/utils/authorization';
import { requireAuthentication } from '~/utils/middleware';

export const introspect = pingFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const tables = [
      ...Object.entries(timetableSchema),
      ...Object.entries(doorlockSchema),
      ...Object.entries(authenticationSchema),
      ...Object.entries(authorizationSchema),
      ...Object.entries(featureFlagSchema),
    ];
    const data = tables.map(([name, table]) =>
      db
        .select()
        .from(table)
        .then((rows) => ({ name, rows }))
    );
    const results = await Promise.all(data);

    return c.json({
      database: results,
      auth: {
        user: {
          ...c.var.user,
          permissions: await getUserPermissions(c.var.session.userId),
        },
        session: c.var.session,
      },
    });
  }
);
