import { defineConfig } from 'drizzle-kit';
import { env } from '~/utils/environment';

export default defineConfig({
  out: './src/database/migrations',
  dialect: 'postgresql',
  schema: './src/database/schema',

  driver: 'pglite',
  dbCredentials: {
    url: env.databaseUrl,
  },

  strict: true,
  verbose: true,
});
