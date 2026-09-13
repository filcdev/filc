import { getLogger } from '@logtape/logtape';
import { SQL } from 'bun';
import { env } from '#utils/environment';
import { configureLogger } from '#utils/logger';
import {
  isPreviewDatabaseName,
  PREVIEW_DATABASE_PREFIX,
  sanitizeDatabaseName,
} from '#utils/preview-database';

await configureLogger('chronos');

const logger = getLogger(['chronos', 'preview-db-cleanup']);

const LEADING_SLASH = /^\//;

const dryRun = process.argv.includes('--dry-run');
const maxAgeDays = env.previewDatabaseMaxAgeDays;
const targetUrl = env.previewDatabaseUrl;

// The cleanup is opt-in: without both CHRONOS_PREVIEW_DATABASE_URL and
// CHRONOS_PREVIEW_DATABASE_MAX_AGE_DAYS it must never touch anything, so it
// only ever runs where preview databases live and only against that server.
if (!(targetUrl && maxAgeDays)) {
  logger.info(
    'Preview database cleanup disabled: set CHRONOS_PREVIEW_DATABASE_URL and CHRONOS_PREVIEW_DATABASE_MAX_AGE_DAYS to enable.'
  );
  process.exit(0);
}

logger.info(`Preview database cleanup targeting ${new URL(targetUrl).host}`);

const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

const databaseNameFrom = (url: string): string =>
  decodeURIComponent(new URL(url).pathname.replace(LEADING_SLASH, ''));

const protectedNames = new Set<string>(env.previewDatabaseProtected ?? []);
// The database the app itself uses (from CHRONOS_DATABASE_URL).
protectedNames.add(databaseNameFrom(env.databaseUrl));
// The database the cleanup connects to (from CHRONOS_PREVIEW_DATABASE_URL).
protectedNames.add(databaseNameFrom(targetUrl));
// The current preview's own database, when this runs inside a preview.
if (env.databaseName) {
  protectedNames.add(sanitizeDatabaseName(env.databaseName));
}

const sql = new SQL({
  adapter: 'postgres',
  prepare: false,
  url: targetUrl,
});

try {
  // PG_VERSION's mtime is set when the database is created, so it is a good
  // proxy for database age. Requires a superuser connection (pg_stat_file).
  const candidates = await sql<
    { created_at: Date; name: string }[]
  >`SELECT datname AS name,
           (pg_stat_file('base/' || oid || '/PG_VERSION')).modification AS created_at
      FROM pg_database
     WHERE datname LIKE ${`${PREVIEW_DATABASE_PREFIX}%`}
       AND datname <> current_database()`;

  const cutoff = Date.now() - maxAgeMs;
  const stale = candidates.filter(
    (row) => new Date(row.created_at).getTime() < cutoff
  );

  if (stale.length === 0) {
    logger.info(
      `No preview databases older than ${maxAgeDays} day(s) (checked ${candidates.length}).`
    );
  }

  for (const row of stale) {
    if (!isPreviewDatabaseName(row.name)) {
      logger.warn(`Skipping unexpected database name ${row.name}`);
      continue;
    }

    if (protectedNames.has(row.name)) {
      logger.info(`Skipping protected database ${row.name}`);
      continue;
    }

    if (dryRun) {
      logger.info(
        `Would drop ${row.name} (created ${row.created_at.toISOString()})`
      );
      continue;
    }

    await sql`SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
               WHERE datname = ${row.name}
                 AND pid <> pg_backend_pid()`;
    // row.name is restricted to [a-z0-9_], so interpolating the identifier is safe.
    await sql.unsafe(`DROP DATABASE "${row.name}"`);
    logger.info(
      `Dropped ${row.name} (created ${row.created_at.toISOString()})`
    );
  }
} finally {
  await sql.close();
}
