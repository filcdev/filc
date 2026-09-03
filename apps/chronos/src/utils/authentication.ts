import { getLogger } from '@logtape/logtape';
import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { customSession } from 'better-auth/plugins';
import { and, eq, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Context } from '#_types/globals';
import { db } from '#database';
import {
  authenticationSchema,
  user as userTable,
} from '#database/schema/authentication';
import { teacher } from '#database/schema/timetable';
import { getUserPermissions } from '#utils/authorization';
import { env } from '#utils/environment';

const logger = getLogger(['chronos', 'auth']);

const authOptions = {
  account: {
    accountLinking: {
      allowUnlinkingAll: true,
      enabled: true,
      trustedProviders: ['microsoft'],
      updateUserInfoOnLink: true,
    },
  },
  advanced: {
    cookiePrefix: 'filc',
    database: {
      generateId: 'uuid',
    },
  },
  baseURL: env.baseUrl,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authenticationSchema,
  }),
  databaseHooks: {
    session: {
      create: {
        // Link the user account to any teacher row whose email matches. This
        // runs on both registration and login (a session is created either
        // way), so an import carrying teacher emails gets reconciled with user
        // accounts over time.
        after: async (session) => {
          try {
            const [linkedUser] = await db
              .select({ email: userTable.email })
              .from(userTable)
              .where(eq(userTable.id, session.userId))
              .limit(1);
            const userEmail = linkedUser?.email?.toLowerCase();
            if (!userEmail) {
              return;
            }
            await db
              .update(teacher)
              .set({ userId: session.userId })
              .where(
                and(
                  eq(teacher.email, userEmail),
                  // Never clobber a manual assignment made in the teacher UI.
                  or(isNull(teacher.userId), eq(teacher.userId, session.userId))
                )
              );
          } catch (err) {
            logger.error('Failed to link user to teacher by email', {
              err,
              userId: session.userId,
            });
          }
        },
      },
    },
    user: {
      create: {
        before: async (user, _ctx) => ({
          data: {
            ...user,
            roles: user.email === env.adminEmail ? ['user', 'admin'] : ['user'],
          },
        }),
      },
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  logger: {
    level: env.mode === 'development' ? 'debug' : 'info',
    log: (level, message, ...args) => {
      logger[level]({ message, ...args });
    },
  },
  plugins: [],
  secret: env.authSecret,
  socialProviders: {
    microsoft: {
      clientId: env.entraClientId,
      clientSecret: env.entraClientSecret,
      enabled: true,
      prompt: env.mode === 'development' ? 'consent' : undefined,
      tenantId: env.entraTenantId,
    },
  },
  telemetry: {
    enabled: false,
  },
  trustedOrigins: env.trustedOrigins ?? [env.baseUrl],
  user: {
    additionalFields: {
      cohortId: {
        input: true,
        required: false,
        type: 'string',
      },
      nickname: {
        input: true,
        required: false,
        type: 'string',
      },
      roles: {
        defaultValue: ['user'],
        input: false,
        required: true,
        type: 'string[]',
      },
    },
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...authOptions,
  plugins: [
    ...(authOptions.plugins ?? []),
    customSession(async ({ user, session }) => {
      const permissions = await getUserPermissions(user.id);
      const displayName = user.nickname
        ? user.nickname
        : user.name || 'Unknown user';
      return {
        session,
        user: {
          ...user,
          displayName,
          permissions,
        },
      };
    }, authOptions),
  ],
});

export const authRouter = new Hono<Context>().on(['POST', 'GET'], '*', (c) =>
  auth.handler(c.req.raw)
);

export type Session = typeof auth.$Infer.Session;
export type User = (typeof auth.$Infer.Session)['user'];
