import { router, auth } from '@filc/api'
import { createBunServeHandler } from 'trpc-bun-adapter'

Bun.serve(
  createBunServeHandler(
    {
      endpoint: '/trpc',
      router,
      responseMeta(_opts) {
        return {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      },
    },
    {
      fetch(req) {
        if (req.url.startsWith('/api/auth')) {
          return auth.handler(req)
        }

        return new Response('Not found', { status: 404 })
      },
    }
  )
)

console.info('Listening on http://localhost:3000')
