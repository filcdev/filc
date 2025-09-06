import { getLogger } from '@logtape/logtape';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { Hono } from 'hono';
import { db } from '~/database';
import { authSchema } from '~/database/schema/authentication';
import { env } from '~/utils/environment';
import type { honoContext } from '~/utils/globals';

const logger = getLogger(['chronos', 'auth']);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  baseURL: env.baseUrl,
  secret: env.authSecret,
  trustedOrigins: [env.baseUrl],
  logger: {
    level: env.mode === 'development' ? 'debug' : 'info',
    log: (level, message, ...args) => {
      logger[level]({ message, ...args });
    },
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
  telemetry: {
    enabled: false,
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  databaseHooks: {
    user: {
      create: {
        // biome-ignore lint/suspicious/useAwait: no need
        before: async (user, _ctx) => {
          return {
            data: {
              ...user,
              roles:
                user.email === env.adminEmail ? ['user', 'admin'] : ['user'],
            },
          };
        },
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        await Promise.resolve(); // simulate async work
        logger.info(`Magic link requested for ${email}: ${url}?token=${token}`);
      },
    }),
  ],
  user: {
    additionalFields: {
      roles: {
        type: 'string[]',
        required: true,
        input: false,
      },
    },
  },
});

export const authRouter = new Hono<honoContext>();

authRouter.on(['POST', 'GET'], '*', (c) => {
  return auth.handler(c.req.raw);
});
