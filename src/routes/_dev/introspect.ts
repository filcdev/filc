import { createSelectSchema } from 'drizzle-zod';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { db } from '~/database';
import { authenticationSchema } from '~/database/schema/authentication';
import { authorizationSchema } from '~/database/schema/authorization';
import { doorlockSchema } from '~/database/schema/doorlock';
import { featureFlagSchema } from '~/database/schema/feature-flag';
import { timetableSchema } from '~/database/schema/timetable';
import { pingFactory } from '~/routes/ping/_factory';
import { getUserPermissions } from '~/utils/authorization';
import { env } from '~/utils/environment';
import type { SuccessResponse } from '~/utils/globals';
import { requireAuthentication } from '~/utils/middleware';
import { ensureJsonSafeDates } from '~/utils/zod';

const schemaEntries = [
  ...Object.entries(timetableSchema),
  ...Object.entries(doorlockSchema),
  ...Object.entries(authenticationSchema),
  ...Object.entries(authorizationSchema),
  ...Object.entries(featureFlagSchema),
];

const schemas = schemaEntries.map(([name, table]) =>
  z.object({
    name: z.literal(name),
    rows: ensureJsonSafeDates(createSelectSchema(table)).array(),
  })
);

const responseSchema = z.object({
  auth: z.object({
    session: z.object({
      createdAt: z.string(),
      expiresAt: z.string(),
      id: z.string(),
      ipAddress: z.string().nullable().optional(),
      token: z.string(),
      updatedAt: z.string(),
      userAgent: z.string().nullable().optional(),
      userId: z.string(),
    }),
    user: z.object({
      cohortId: z.string().nullable().optional(),
      createdAt: z.string(),
      email: z.string(),
      emailVerified: z.boolean(),
      id: z.string(),
      image: z.string().nullable().optional(),
      name: z.string(),
      permissions: z.array(z.string()),
      roles: z.array(z.string()),
      updatedAt: z.string(),
    }),
  }),
  database: z.array(z.union(schemas)),
});

export const introspect = pingFactory.createHandlers(
  describeRoute({
    description: 'Introspect the database and authentication state',
    hide: env.mode !== 'development',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(responseSchema) },
        },
        description: 'Successful response',
      },
    },
    tags: ['Development'],
  }),
  requireAuthentication,
  async (c) => {
    const data = schemaEntries.map(([name, table]) =>
      db
        .select()
        .from(table)
        .then((rows) => ({ name, rows }))
    );
    const results = await Promise.all(data);

    return c.json<SuccessResponse>({
      data: {
        auth: {
          session: c.var.session,
          user: {
            ...c.var.user,
            permissions: await getUserPermissions(c.var.session.userId),
          },
        },
        database: results,
      },
      success: true,
    });
  }
);
