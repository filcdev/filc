import { auth, router } from '@filc/api'
import { createBunServeHandler } from 'trpc-bun-adapter'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

Bun.serve(
  createBunServeHandler(
    {
      endpoint: '/trpc',
      router,
      responseMeta(_opts) {
        return {
          status: 200,
          headers: corsHeaders
        }
      },
    },
    {
      async fetch(req) {
        let res = new Response('Not found', { status: 404 })

        if (new URL(req.url).pathname.startsWith('/api/auth')) {
          res = await auth.handler(req)
        }

        if (req.method === 'OPTIONS') {
          res = new Response(null, { status: 204 })
        }

        res.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*')
        res.headers.set('Access-Control-Allow-Credentials', 'true')
        res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        res.headers.set

        

        return res
      },
    }
  )
)

console.info('Listening on http://localhost:3000')
