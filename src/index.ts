import { swaggerUI } from '@hono/swagger-ui';
import { getLogger } from '@logtape/logtape';
import { Hono } from 'hono';
import { type BunWebSocketData, websocket } from 'hono/bun';
import { showRoutes } from 'hono/dev';
import { HTTPException } from 'hono/http-exception';
import { openAPIRouteHandler } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import { prepareDb } from '~/database';
import { frontend } from '~/frontend/server';
import { cohortRouter } from '~/routes/cohort/_router';
import { doorlockRouter } from '~/routes/doorlock/_router';
import { pingRouter } from '~/routes/ping/_router';
import { timetableRouter } from '~/routes/timetable/_router';
import { authRouter } from '~/utils/authentication';
import { initializeRBAC } from '~/utils/authorization';
import { env } from '~/utils/environment';
import type { Context, ErrorResponse } from '~/utils/globals';
import { configureLogger } from '~/utils/logger';
import { authenticationMiddleware } from '~/utils/middleware';
import { corsMiddleware, securityMiddleware } from '~/utils/security';
import { timingMiddleware } from '~/utils/timing';

await configureLogger('chronos');
const logger = getLogger(['chronos', 'server']);

if (env.mode === 'development') {
  logger.warn('Running in development mode, do not use in production!');
}

export const api = new Hono<Context>();

await prepareDb();
await initializeRBAC();

api.use('*', corsMiddleware);
api.use('*', authenticationMiddleware);
api.use('*', securityMiddleware);
api.use('*', timingMiddleware);

api.route('/auth', authRouter);
api.route('/ping', pingRouter);
api.route('/timetable', timetableRouter);
api.route('/cohort', cohortRouter);
api.route('/doorlock', doorlockRouter);

api.onError((err, c) => {
  logger.error('UNCAUGHT API error occurred:', {
    message: err.message,
    stack: err.stack,
  });

  if (err instanceof HTTPException) {
    const errResponse =
      err.res ??
      c.json<ErrorResponse>(
        {
          cause: env.mode === 'production' ? undefined : err.cause,
          error: err.message,
          success: false,
        },
        err.status
      );
    return errResponse;
  }

  return c.json<ErrorResponse>(
    {
      cause: err instanceof Error ? err.cause : undefined,
      error:
        env.mode === 'production'
          ? 'Internal Server Error'
          : (err.stack ?? err.message),
      success: false,
    },
    StatusCodes.INTERNAL_SERVER_ERROR
  );
});

api.get(
  '/doc/openapi.json',
  openAPIRouteHandler(api, {
    documentation: {
      info: {
        description: 'API for consumption by the Filc app family.',
        title: 'Chronos backend API',
        version: '0.0.1',
      },
      servers: [
        { description: 'Local Server', url: 'http://localhost:3000/api' },
      ],
    },
  })
);
api.get('/doc/swagger', swaggerUI({ url: '/api/doc/openapi.json' }));

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

let server: Bun.Server<BunWebSocketData> | null = null;

const handleStartup = async () => {
  await prepareDb();
  await initializeRBAC();

  if (env.mode !== 'development') {
    server = Bun.serve({
      fetch: app.fetch,
      port: env.port,
      websocket,
    });
  }

  logger.info('chronos started on http://localhost:3000');
  if (env.logLevel === 'trace') {
    logger.info('Log level set to TRACE, verbose route listing enabled');
    showRoutes(app, { verbose: true });
  }
};

const handleShutdown = () => {
  logger.info('Shutting down chronos...');
  logger.info('Shutdown complete, exiting.');
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

await handleStartup();

export type ApiType = typeof api;
export type AppType = typeof app;

export { server };

export default env.mode === 'development'
  ? {
      fetch: app.fetch,
      websocket,
    }
  : null;
