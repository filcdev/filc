import { defineConfig } from 'drizzle-kit';
import { env } from '#utils/environment';

export default defineConfig({
  dbCredentials: {
    ssl: false,
    url: env.databaseUrl,
  },
  dialect: 'postgresql',
  out: './src/database/migrations',
  schema: './src/database/schema',

  strict: true,
  verbose: true,
});
