import type { Request } from 'express'
import * as trpcExpress from '@trpc/server/adapters/express'
import cors from 'cors'
import express from 'express'

import { appRouter, createTRPCContext } from '@filc/api'
import { appConfig, backendConfig } from '@filc/config'
import { seedRolesAndPermissions } from '@filc/rbac'
import { migrate } from '@filc/db'

async function main() {
  console.log(`Starting ${appConfig.name} v${appConfig.version}`)

  try {
    await migrate()
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
    res.send(`${appConfig.name} API Server`)
  })

  // Use port from config with environment variable fallback
  const PORT = backendConfig.port

  app.listen(PORT, () => {
    console.log(
      `✅ Server is running on ${backendConfig.url || `http://localhost:${PORT}`}`
    )
  })
}

main().catch(console.error)
