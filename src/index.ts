import { getLogger } from '@logtape/logtape';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { showRoutes } from 'hono/dev';
import { prepareDb } from '~/database';
import { developmentRouter } from '~/routes/_dev/_router';
import { pingRouter } from '~/routes/ping/_router';
import { auth, authRouter } from '~/utils/authentication';
import { env } from '~/utils/environment';
import type { honoContext } from '~/utils/globals';
import { configureLogger } from '~/utils/logger';

await configureLogger();
const logger = getLogger(['chronos', 'server']);

await prepareDb();

const app = new Hono<honoContext>();

app.use(
  '*',
  cors({
    origin: env.mode === 'development' ? '*' : env.baseUrl,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set('user', null);
    c.set('session', null);
    return next();
  }

  c.set('user', session.user);
  c.set('session', session.session);
  return next();
});

// routes
env.mode === 'development' && app.route('/_dev', developmentRouter);
app.route('/auth', authRouter);
app.route('/ping', pingRouter);

Bun.serve({
  fetch: app.fetch,
});

logger.info('chronos started on http://localhost:3000');
env.mode === 'development' && showRoutes(app, { verbose: true });
