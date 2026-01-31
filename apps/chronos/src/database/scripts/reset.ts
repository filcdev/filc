import { confirm } from '@inquirer/prompts';
import { getLogger } from '@logtape/logtape';
import { getTableName, sql } from 'drizzle-orm';
import { db } from '#database/index';
import { authenticationSchema } from '#database/schema/authentication';
import { authorizationSchema } from '#database/schema/authorization';
import { doorlockSchema } from '#database/schema/doorlock';
import { timetableSchema } from '#database/schema/timetable';
import { configureLogger } from '#utils/logger';

await configureLogger('chronos');

const logger = getLogger(['chronos', 'drizzle']);

const reset = async () => {
  logger.warn(
    'If this errors without completing, the database may be left in an inconsistent state.'
  );

  const nukeAuth = await confirm({
    message: 'Do you want to delete auth tables as well?',
  });

  const proceed = await confirm({
    message:
      'This will DELETE ALL DATA in the Chronos database. Are you sure you want to continue?',
  });

  if (!proceed) {
    logger.info('Aborting reset operation.');
    process.exit(1);
  }

  const schema = {
    ...(nukeAuth ? authenticationSchema : {}),
    ...(nukeAuth ? authorizationSchema : {}),
    ...doorlockSchema,
    ...timetableSchema,
  };

  // disable foreign key checks
  logger.info('Disabling foreign key checks');
  await db.execute(sql.raw('SET session_replication_role = replica;'));

  for (const table of Object.values(schema)) {
    logger.info(`Deleting all records from table: ${getTableName(table)}`);
    await db.delete(table);
  }

  logger.info('Re-enabling foreign key checks');
  await db.execute(sql.raw('SET session_replication_role = DEFAULT;'));
};

await reset();
