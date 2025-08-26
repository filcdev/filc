import { getLogger } from '@logtape/logtape';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins/admin';
import { magicLink } from 'better-auth/plugins/magic-link';
import { Hono } from 'hono';
import { db } from '~/database';
import { authSchema } from '~/database/schema/authentication';
import { env } from '~/utils/environment';
import type { honoContext } from '~/utils/globals';
import { ac, roles } from '~/utils/permissions';

const logger = getLogger(['chronos', 'auth']);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  baseURL: env.baseUrl,
  secret: env.authSecret,
  basePath: '/auth',
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
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        await Promise.resolve(); // simulate async work
        logger.info(`Magic link requested for ${email}: ${url}?token=${token}`);
      },
    }),
    admin({
      ac,
      roles,
    }),
  ],
});

export const authRouter = new Hono<honoContext>();

authRouter.on(['POST', 'GET'], '*', (c) => {
  return auth.handler(c.req.raw);
});
