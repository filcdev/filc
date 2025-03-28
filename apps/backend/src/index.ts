import type { Request } from 'express'
import * as trpcExpress from '@trpc/server/adapters/express'
import cors from 'cors'
import express from 'express'
import dotenv from 'dotenv'

import { appRouter, createTRPCContext } from '@filc/api'
import { seedRolesAndPermissions } from '@filc/rbac'

async function main() {
  try {
    await seedRolesAndPermissions()
  } catch (error) {
    console.error('Failed to seed roles and permissions:', error)
  }

  const app = express()
  app.use(cors<Request>())
  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: (opts: trpcExpress.CreateExpressContextOptions) =>
        createTRPCContext(opts)
    })
  )
  app.get('/', (req, res) => {
    res.send('Hello World')
  })

  const PORT = process.env.PORT ?? 4000
  app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`)
  })
}

dotenv.config()

main().catch(console.error)
