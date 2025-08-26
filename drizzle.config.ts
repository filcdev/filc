import { defineConfig } from 'drizzle-kit';
import { env } from '~/utils/environment';

export default defineConfig({
  out: './src/database/migrations',
  dialect: 'postgresql',
  schema: './src/database/schema',

  dbCredentials: {
    url: env.databaseUrl,
    ssl: false
  },

  strict: true,
  verbose: true,
});