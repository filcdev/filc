import { getLogger } from '@logtape/logtape';
import { SQL, type sql } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { apiKeySchema } from '#database/schema/api-keys';
import { authenticationSchema } from '#database/schema/authentication';
import { authorizationSchema } from '#database/schema/authorization';
import { bugReportSchema } from '#database/schema/bug-report';
import { doorlockSchema } from '#database/schema/doorlock';
import { newsSchema } from '#database/schema/news';
import { notificationsSchema } from '#database/schema/notifications';
import { timetableSchema } from '#database/schema/timetable';
import { env } from '#utils/environment';

const logger = getLogger(['chronos', 'drizzle']);

const sanitizeDatabaseName = (value: string): string => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `filc_${cleaned}`.slice(0, 63);
};

// Preview deployments set CHRONOS_DATABASE_NAME to a per-preview value (e.g.
// $COOLIFY_FQDN) so each preview gets its own database on the shared Postgres
// server in CHRONOS_DATABASE_URL. Production leaves it unset.
const resolveDatabaseUrl = async (): Promise<string> => {
  if (!env.databaseName) {
    return env.databaseUrl;
  }

  const name = sanitizeDatabaseName(env.databaseName);
  const url = new URL(env.databaseUrl);
  if (url.pathname.slice(1) === name) {
    return env.databaseUrl;
  }

  const admin = new SQL({
    adapter: 'postgres',
    prepare: false,
    url: env.databaseUrl,
  });
  try {
    const existing =
      await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (existing.length === 0) {
      // `name` is restricted to [a-z0-9_], so interpolating the identifier is safe.
      await admin.unsafe(`CREATE DATABASE "${name}"`);
    }
  } catch (error) {
    // A concurrent boot can create the database between the check and the create.
    const existing =
      await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (existing.length === 0) {
      throw error;
    }
  } finally {
    await admin.close();
  }

  url.pathname = `/${name}`;
  return url.toString();
};

const databaseUrl = await resolveDatabaseUrl();

let client: null | typeof sql = null;

const createClient = () =>
  new SQL({
    adapter: 'postgres',
    prepare: false,
    url: databaseUrl,
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

const schema = {
  ...apiKeySchema,
  ...authenticationSchema,
  ...authorizationSchema,
  ...bugReportSchema,
  ...doorlockSchema,
  ...newsSchema,
  ...notificationsSchema,
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
