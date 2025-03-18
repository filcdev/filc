import type { Request } from 'express'
import * as trpcExpress from '@trpc/server/adapters/express'
import cors from 'cors'
import express from 'express'

import { appRouter, createTRPCContext } from '@filc/api'

const app = express()

app.use(cors<Request>())

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        headers: new Headers()
      })
  })
)

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(4000)

console.log('Server is running on http://localhost:4000')
