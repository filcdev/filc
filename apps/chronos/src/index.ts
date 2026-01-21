import { swaggerUI } from '@hono/swagger-ui';
import { getLogger } from '@logtape/logtape';
import type { Session } from 'better-auth';
import { Hono } from 'hono';
import { getConnInfo, websocket } from 'hono/bun';
import { showRoutes } from 'hono/dev';
import { HTTPException } from 'hono/http-exception';
import { openAPIRouteHandler } from 'hono-openapi';
import { rateLimiter } from 'hono-rate-limiter';
import { StatusCodes } from 'http-status-codes';
import { prepareDb } from '#database';
import { authenticationMiddleware } from '#middleware/auth';
import { corsMiddleware, securityMiddleware } from '#middleware/security';
import { timingMiddleware } from '#middleware/timing';
import { cohortRouter } from '#routes/cohort/_router';
import { doorlockRouter } from '#routes/doorlock/_router';
import { pingRouter } from '#routes/ping/_router';
import { timetableRouter } from '#routes/timetable/_router';
import { usersRouter } from '#routes/users/_router';
import { authRouter } from '#utils/authentication';
import { initializeRBAC } from '#utils/authorization';
import { setupCronJobs } from '#utils/cron';
import { env } from '#utils/environment';
import { configureLogger } from '#utils/logger';
import type { Context, ErrorResponse } from '#utils/types/globals';

await configureLogger('chronos');
const logger = getLogger(['chronos', 'server']);

if (env.mode === 'development') {
  logger.warn('Running in development mode, do not use in production!');
}

export const api = new Hono<Context>();

await prepareDb();
await initializeRBAC();
setupCronJobs();

api.use('*', corsMiddleware);
api.use('*', authenticationMiddleware);
api.use('*', securityMiddleware);
api.use('*', timingMiddleware);

api.use(
  '*',
  rateLimiter({
    handler: async (c, _, options) => {
      // Log the rate limit event
      logger.debug(`Rate limit exceeded for ${await options.keyGenerator(c)}`);

      // Return custom response
      return c.json<ErrorResponse>(
        {
          data: {
            retryAfter: c.res.headers.get('Retry-After'),
          },
          error: 'Too many requests',
          success: false,
        },
        429
      );
    },
    keyGenerator: (c) => {
      const session = c.get('session' as never) as Session | null;
      const userAgent = c.req.header('User-Agent') ?? 'unknown';
      const connInfo = getConnInfo(c);
      const realIp = c.req.header(env.realIpHeader ?? 'X-Forwarded-For');
      const uuid = `|${userAgent}|${session ? session.id : 'none'}|${realIp ? realIp : (connInfo.remote.address ?? 'unknown')}`;
      return uuid;
    },
    limit: 180,
    windowMs: 60 * 1000,
  })
);

api.route('/auth', authRouter);
api.route('/ping', pingRouter);
api.route('/timetable', timetableRouter);
api.route('/cohort', cohortRouter);
api.route('/doorlock', doorlockRouter);
api.route('/users', usersRouter);

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
        env.mode === 'development'
          ? { description: 'Local Server', url: 'http://localhost:3000/api' }
          : { description: 'chronos', url: 'https://dev.filc.space/api' },
      ],
    },
  })
);
api.get('/doc/swagger', swaggerUI({ url: '/api/doc/openapi.json' }));

const app = new Hono();
app.route('/api', api);

app.onError((err, c) => {
  logger.error('Unhandled error occurred:', {
    message: err.message,
    stack: err.stack,
  });
  return c.redirect('/error');
});

export const server = Bun.serve({
  fetch: app.fetch,
  port: env.port,
  websocket,
});

logger.info(`chronos listening on http://localhost:${env.port}`);
if (env.logLevel === 'trace') {
  logger.info('Log level set to TRACE, verbose route listing enabled');
  showRoutes(app, { verbose: true });
}

const handleShutdown = async () => {
  logger.info('Shutting down chronos...');
  await server.stop();
  logger.info('Shutdown complete, exiting.');
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

export type ApiType = typeof api;
export type AppType = typeof app;
