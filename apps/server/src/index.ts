import { auth, appRouter, createTRPCContext } from '@filc/api'
import { appConfig } from '@filc/config'
import { createBunServeHandler } from 'trpc-bun-adapter'

const corsHeaders = {
  'Access-Control-Allow-Origin': appConfig.frontend.url,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

Bun.serve(
  createBunServeHandler(
    {
      endpoint: '/trpc',
      router: appRouter,
      createContext: createTRPCContext,
      responseMeta(_opts) {
        return {
          status: 200,
          headers: corsHeaders,
        }
      },
    },
    {
      async fetch(req) {
        let res = new Response('Not found', { status: 404 })
        const path = new URL(req.url).pathname

        if (req.method === 'OPTIONS') {
          res = new Response(null, { status: 204 })
        } else if (path.startsWith('/api/auth')) {
          res = await auth.handler(req)
        } else if (path.startsWith('/test') && appConfig.env === 'development') {
          const { renderTrpcPanel } = await import('trpc-ui')
            res = new Response(
            new TextEncoder().encode(
              renderTrpcPanel(appRouter, {
              url: 'http://localhost:3000/trpc',
              meta: { title: 'Filc TRPC Test' }
              })
            ),
            {
              headers: {
              'Content-Type': 'text/html',
              },
            }
            )
        }

        res.headers.set(
          'Access-Control-Allow-Origin',
          req.headers.get('origin') || '*'
        )
        res.headers.set('Access-Control-Allow-Credentials', 'true')
        res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.headers.set(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization'
        )
        res.headers.set

        return res
      },
    }
  )
)

console.info(`Running in ${appConfig.env} mode`)
console.info('Listening on http://localhost:3000')
