import { getLogger } from '@logtape/logtape';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { showRoutes } from 'hono/dev';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { migrateDb } from '~/database';
import { auth } from '~/utils/authentication';
import { env } from '~/utils/environment';
import { configureLogger } from '~/utils/logger';

await configureLogger();
const logger = getLogger(['chronos', 'server']);

await migrateDb();

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

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

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.get('/session', (c) => {
  const session = c.get('session');
  const user = c.get('user');

  if (!user) {
    return c.body(
      getReasonPhrase(StatusCodes.UNAUTHORIZED),
      StatusCodes.UNAUTHORIZED
    );
  }

  return c.json({
    session,
    user,
  });
});

app.on(['POST', 'GET'], '/auth/*', (c) => {
  return auth.handler(c.req.raw);
});

Bun.serve({
  fetch: app.fetch,
});

logger.info('Server started on http://localhost:3000');

env.mode === 'development' && showRoutes(app, { verbose: true });
