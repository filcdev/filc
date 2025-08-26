import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { db } from '~/database';
import { env } from '~/utils/environment';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    debugLogs: env.mode === 'development',
  }),
  advanced: {
    database: {
      generateId: false,
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }, request) => {
        // TODO: add logger
      },
    }),
  ],
  telemetry: {
    enabled: false,
  },
});
