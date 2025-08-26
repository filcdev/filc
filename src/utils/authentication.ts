import { getLogger } from '@logtape/logtape';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { db } from '~/database';
import { env } from '~/utils/environment';

const logger = getLogger(['chronos', 'auth']);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    debugLogs: env.mode === 'development',
  }),
  baseURL: env.baseUrl,
  secret: env.authSecret,
  basePath: '/auth',
  trustedOrigins: [env.baseUrl],
  logger: {
    level: env.mode === 'development' ? 'debug' : 'info',
    log: (level, message, ...args) => {
      logger[level](message, ...args);
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
  ],
});
