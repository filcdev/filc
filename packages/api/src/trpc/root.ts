import { pingRouter } from '../route/ping'
import { createTRPCRouter } from './index.ts'

export const appRouter = createTRPCRouter({
  ping: pingRouter,
})

export type AppRouter = typeof appRouter
