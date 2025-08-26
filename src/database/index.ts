import { getLogger } from '@logtape/logtape';
import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { env } from '~/utils/environment';

const logger = getLogger(['chronos', 'drizzle']);

const client = new SQL(env.databaseUrl);

export const db = drizzle({ client });

export const migrateDb = async () => {
  try {
    await migrate(db, { migrationsFolder: 'src/database/migrations' });
    logger.info('Database migration completed successfully.');
  } catch (error) {
    logger.fatal(`Database migration failed: ${error}`);
  }
};
