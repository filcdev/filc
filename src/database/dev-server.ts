import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { getLogger } from '@logtape/logtape';
import { configureLogger } from '~/utils/logger';

// needs to be configured seperately as we are being run with run-p
await configureLogger('pglite');

const logger = getLogger(['chronos', 'database']);
const db = await PGlite.create({
  dataDir: './db.local',
});

const server = new PGLiteSocketServer({
  db,
  port: 5432,
  host: '127.0.0.1',
});

await server.start();
logger.info('PGLite started on 127.0.0.1:5432');

const handleExit = async () => {
  await server.stop();
  await db.close();
  logger.info('PGLite stopped and database closed');
  process.exit(0);
};

// handle exit both if the process is killed or interrupted
process.on('SIGTERM', handleExit);
process.on('SIGINT', handleExit);
