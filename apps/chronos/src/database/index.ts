import { getLogger } from '@logtape/logtape';
import { SQL, type sql } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { apiKeySchema } from '#database/schema/api-keys';
import { authenticationSchema } from '#database/schema/authentication';
import { authorizationSchema } from '#database/schema/authorization';
import { moduleSchemas } from '#modules/schemas';
import { env } from '#utils/environment';

const logger = getLogger(['chronos', 'drizzle']);

let client: null | typeof sql = null;

const createClient = () =>
  new SQL({
    adapter: 'postgres',
    prepare: false,
    url: env.databaseUrl,
  });

if (env.mode === 'production') {
  client = createClient();
} else {
  const globalConn = global as typeof globalThis & {
    connection: null | typeof sql;
  };

  if (!globalConn.connection) {
    globalConn.connection = createClient();
  }

  client = globalConn.connection;
}

/**
 * The shared identity and RBAC tables, plus every module's own tables. The two
 * are merged rather than concatenated so a module's tables are named once, in
 * `src/modules/schemas.ts`, and never here.
 */
const schema = {
  ...apiKeySchema,
  ...authenticationSchema,
  ...authorizationSchema,
  ...moduleSchemas,
};

export const db = drizzle({
  client,
  logger: {
    logQuery: (query) => {
      if (env.drizzleDebug) {
        logger.trace(
          env.mode === 'production'
            ? `Executing query: ${query}`
            : 'Executing query',
          { query }
        );
      }
    },
  },
  schema,
});

export const prepareDb = async () => {
  try {
    logger.debug('Starting database migration');
    await migrate(db, {
      migrationsFolder: 'src/database/migrations',
    });
    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.fatal(`Database migration failed: ${error}`);
    throw error;
  }
};
