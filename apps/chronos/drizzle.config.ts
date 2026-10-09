import { defineConfig } from 'drizzle-kit';
import { env } from '#utils/environment';

export default defineConfig({
  dbCredentials: {
    ssl: false,
    url: env.databaseUrl,
  },
  dialect: 'postgresql',
  out: './src/database/migrations',
  // The shared identity/RBAC tables, plus whatever each module owns. A glob so
  // a new module's schema never has to be registered here.
  schema: ['./src/database/schema/*.ts', './src/modules/*/schema.ts'],

  strict: true,
  verbose: true,
});
