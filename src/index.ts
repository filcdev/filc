import { getLogger } from '@logtape/logtape';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { showRoutes } from 'hono/dev';
import { prepareDb } from '~/database';
import { frontend } from '~/frontend/server';
import { handleMqttShutdown, initializeMqttClient } from '~/mqtt/client';
import { developmentRouter } from '~/routes/_dev/_router';
import { doorlockRouter } from '~/routes/doorlock/_router';
import { featureFlagRouter } from '~/routes/feature-flags/_router';
import { pingRouter } from '~/routes/ping/_router';
import { timetableRouter } from '~/routes/timetable/_router';
import { authRouter } from '~/utils/authentication';
import { startDeviceMonitor, stopDeviceMonitor } from '~/utils/device-monitor';
import { env } from '~/utils/environment';
import { handleFeatureFlag } from '~/utils/feature-flag';
import type { honoContext } from '~/utils/globals';
import { configureLogger } from '~/utils/logger';
import { authenticationMiddleware } from '~/utils/middleware';
import { initializeRBAC } from './utils/authorization';

await configureLogger();
const logger = getLogger(['chronos', 'server']);

env.mode === 'development' &&
  logger.warn('Running in development mode, do not use in production!');

const api = new Hono<honoContext>();

await prepareDb();
await initializeRBAC();

api.use(
  '*',
  cors({
    origin: env.mode === 'development' ? '*' : env.baseUrl,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

api.use('*', authenticationMiddleware);

env.mode === 'development' &&
  api.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.trace(`${c.req.method} ${c.req.url} - ${ms}ms`, {
      method: c.req.method,
      url: c.req.url,
      duration: ms,
      user: c.get('user')
        ? { id: c.get('user')?.id, email: c.get('user')?.email }
        : null,
    });
  });

// routes
env.mode === 'development' && api.route('/_dev', developmentRouter);
api.route('/auth', authRouter);
api.route('/ping', pingRouter);
api.route('/timetable', timetableRouter);
api.route('/feature-flags', featureFlagRouter);
(await handleFeatureFlag('doorlock:api', 'Enable doorlock API', false))
  ? api.route('/doorlock', doorlockRouter)
  : logger.info('Doorlock API is disabled by feature flag');

const app = new Hono();
app.route('/api', api);
app.route('/', frontend);

const handleStartup = async () => {
  await prepareDb();
  await initializeRBAC();
  await initializeMqttClient();
  await startDeviceMonitor();

  logger.info('chronos started on http://localhost:3000');
  env.logLevel === 'trace' && showRoutes(app, { verbose: true });
};

const handleShutdown = () => {
  logger.info('Shutting down chronos...');
  handleMqttShutdown();
  stopDeviceMonitor();
  logger.info('Shutdown complete, exiting.');
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

await handleStartup();

export type AppType = typeof app;

export default app;
