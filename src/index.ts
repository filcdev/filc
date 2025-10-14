import { getLogger } from '@logtape/logtape';
import { Hono } from 'hono';
import { getConnInfo } from 'hono/bun';
import { cors } from 'hono/cors';
import { showRoutes } from 'hono/dev';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { prepareDb } from '~/database';
import { frontend } from '~/frontend/server';
import { handleMqttShutdown, initializeMqttClient } from '~/mqtt/client';
import { developmentRouter } from '~/routes/_dev/_router';
import { cohortRouter } from '~/routes/cohort/_router';
import { doorlockRouter } from '~/routes/doorlock/_router';
import { featureFlagRouter } from '~/routes/feature-flags/_router';
import { pingRouter } from '~/routes/ping/_router';
import { timetableRouter } from '~/routes/timetable/_router';
import { authRouter } from '~/utils/authentication';
import { initializeRBAC } from '~/utils/authorization';
import { startDeviceMonitor, stopDeviceMonitor } from '~/utils/device-monitor';
import { env } from '~/utils/environment';
import { handleFeatureFlag } from '~/utils/feature-flag';
import type { Context, ErrorResponse } from '~/utils/globals';
import { configureLogger } from '~/utils/logger';
import { authenticationMiddleware } from '~/utils/middleware';
import { securityMiddleware } from '~/utils/security';

await configureLogger('chronos');
const logger = getLogger(['chronos', 'server']);

env.mode === 'development' &&
  logger.warn('Running in development mode, do not use in production!');

const api = new Hono<Context>();

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

env.mode === 'production' && api.use('*', securityMiddleware);

api.onError((err, c) => {
  if (err instanceof HTTPException) {
    const errResponse =
      err.res ??
      c.json<ErrorResponse>(
        {
          success: false,
          error: err.message,
        },
        err.status
      );
    return errResponse;
  }

  return c.json<ErrorResponse>(
    {
      success: false,
      error:
        env.mode === 'production'
          ? 'Internal Server Error'
          : (err.stack ?? err.message),
      cause: err instanceof Error ? err.cause : undefined,
    },
    StatusCodes.INTERNAL_SERVER_ERROR
  );
});

env.mode === 'development'
  ? api.use('*', async (c, next) => {
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
    })
  : api.use('*', async (c, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      const connInfo = getConnInfo(c);
      logger.info('Received request', {
        ua: c.req.header('user-agent') ?? 'unknown',
        ip: connInfo?.remote.address ?? 'unknown',
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
api.route('/feature-flags', featureFlagRouter);
api.route('/timetable', timetableRouter);
api.route('/cohort', cohortRouter);

// Register feature flag for doorlock API with initial check
await handleFeatureFlag('doorlock:api', 'Enable doorlock API', false);
api.route('/doorlock', doorlockRouter);

const app = new Hono();
app.route('/api', api);
app.route('/', frontend);

app.onError((err, c) => {
  logger.error('Unhandled error occurred:', {
    message: err.message,
    stack: err.stack,
  });
  return c.redirect('/error');
});

const handleStartup = async () => {
  await prepareDb();
  await initializeRBAC();
  await initializeMqttClient();
  await startDeviceMonitor();

  env.mode === 'production' &&
    Bun.serve({
      port: env.port,
      fetch: app.fetch,
    });

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

export type ApiType = typeof api;
export type AppType = typeof app;

export default env.mode === 'development' ? app : null;
