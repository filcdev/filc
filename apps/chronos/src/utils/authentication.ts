import { getLogger } from '@logtape/logtape';
import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { customSession } from 'better-auth/plugins';
import { Hono } from 'hono';
import { db } from '#database';
import { authenticationSchema } from '#database/schema/authentication';
import { getUserPermissions } from '#utils/authorization';
import { env } from '#utils/environment';
import type { Context } from '#utils/globals';

const logger = getLogger(['chronos', 'auth']);

const authOptions = {
  account: {
    accountLinking: {
      allowUnlinkingAll: true,
      enabled: true,
      updateUserInfoOnLink: true,
    },
  },
  advanced: {
    cookiePrefix: 'filc',
    database: {
      generateId: false,
    },
  },

  baseURL: env.baseUrl,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authenticationSchema,
  }),
  databaseHooks: {
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
      prompt: 'consent',
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
