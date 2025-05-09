import { createContext } from '@filc/api/trpc'
import { appRouter } from '@filc/api/trpc/root'
import { auth } from '@filc/auth'
import { appConfig } from '@filc/config'
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
    pino: createLogger('server'),
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

app.use(
  '/api/trpc/*',
  trpcServer({
    endpoint: '/api/trpc',
    router: appRouter,
    createContext,
  })
)

app.on(['POST', 'GET'], '/api/auth/*', c => {
  return auth.handler(c.req.raw)
})

export default app
