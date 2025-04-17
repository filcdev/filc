import { pingRouter } from '@/route/ping'
import { createTRPCRouter } from '@/trpc'

export const appRouter = createTRPCRouter({
  ping: pingRouter,
})

export type AppRouter = typeof appRouter
