import { getLogger } from '@logtape/logtape';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { showRoutes } from 'hono/dev';
import { prepareDb } from '~/database';
import { developmentRouter } from '~/routes/_dev/_router';
import { pingRouter } from '~/routes/ping/_router';
import { timetableRouter } from '~/routes/timetable/_router';
import { auth, authRouter } from '~/utils/authentication';
import { env } from '~/utils/environment';
import type { honoContext } from '~/utils/globals';
import { configureLogger } from '~/utils/logger';
import { authenticationMiddleware } from '~/utils/middleware';
import { initializeRBAC } from './utils/authorization';

await configureLogger();
const logger = getLogger(['chronos', 'server']);

env.mode === 'development' &&
  logger.warn('Running in development mode, do not use in production!');

await prepareDb();
await initializeRBAC();

const app = new Hono<honoContext>();

app.use(
  '*',
  cors({
    origin: env.mode === 'development' ? '*' : env.baseUrl,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use('*', authenticationMiddleware);

env.mode === 'development' &&
  app.use('*', async (c, next) => {
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
env.mode === 'development' && app.route('/_dev', developmentRouter);
app.route('/auth', authRouter);
app.route('/ping', pingRouter);
app.route('/timetable', timetableRouter);

Bun.serve({
  fetch: app.fetch,
});

logger.info('chronos started on http://localhost:3000');
env.mode === 'development' && showRoutes(app, { verbose: true });
