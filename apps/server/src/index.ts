import { createContext } from '@filc/api/trpc'
import { appRouter } from '@filc/api/trpc/root'
import { auth } from '@filc/auth'
import { appConfig } from '@filc/config'
import { run as migrateDatabase } from '@filc/db/migrate'
import { createLogger } from '@filc/log'
import { trpcServer } from '@hono/trpc-server'
import { Hono } from 'hono'
import { pinoLogger } from 'hono-pino'
import { cors } from 'hono/cors'

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null
    session: typeof auth.$Infer.Session.session | null
  }
}>()

const logger = createLogger('server')

app.use(
  '*',
  cors({
    origin: appConfig.frontend.url,
    credentials: true,
  })
)

app.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session) {
    c.set('user', null)
    c.set('session', null)
    return next()
  }

  c.set('user', session.user)
  c.set('session', session.session)
  return next()
})

app.use(
  '*',
  pinoLogger({
    pino: logger,
    http: { onReqLevel: _ => 'debug' },
  })
)

app.get('/panel', async c => {
  if (appConfig.env !== 'development') {
    return
  }

  const { renderTrpcPanel } = await import('trpc-ui')

  return c.html(
    renderTrpcPanel(appRouter, {
      url: 'http://localhost:3000/api/trpc',
      transformer: 'superjson',
    })
  )
})

app.get('/', c => {
  return c.json({
    message: 'Hello from Filc API',
  })
})

app.get('/config', c =>
  c.json({
    env: appConfig.env,
    app: appConfig.app,
    frontend: appConfig.frontend,
  })
)

app.use(
  '/trpc/*',
  trpcServer({
    endpoint: '/trpc',
    router: appRouter,
    createContext,
  })
)

app.on(['POST', 'GET'], '/auth/*', c => {
  return auth.handler(c.req.raw)
})

app.onError((err, c) => {
  logger.error(err)
  return c.json(
    {
      message: 'Internal Server Error',
    },
    500
  )
})

migrateDatabase()

Bun.serve({
  fetch: app.fetch,
})

logger.info('Server started on port 3000')
