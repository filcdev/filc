import { getLogger } from '@logtape/logtape';
import { SQL, type sql } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { relations } from '#database/relations';
import { authenticationSchema } from '#database/schema/authentication';
import { authorizationSchema } from '#database/schema/authorization';
import { doorlockSchema } from '#database/schema/doorlock';
import { timetableSchema } from '#database/schema/timetable';
import { env } from '#utils/environment';

const logger = getLogger(['chronos', 'drizzle']);

let client: null | typeof sql = null;

const createClient = () =>
  new SQL({
    adapter: 'postgres',
    prepare: false,
    url: env.databaseUrl,
  });

if (env.mode !== 'production') {
  const globalConn = global as typeof globalThis & {
    connection: null | typeof sql;
  };

  if (!globalConn.connection) {
    globalConn.connection = createClient();
  }

  client = globalConn.connection;
} else {
  client = createClient();
}

const schema = {
  ...authenticationSchema,
  ...authorizationSchema,
  ...doorlockSchema,
  ...timetableSchema,
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
  relations,
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
