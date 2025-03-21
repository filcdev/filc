import { authRouter } from './router/auth'
import { classRouter } from './router/class'
import { createTRPCRouter } from './trpc'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  class: classRouter
})

export type AppRouter = typeof appRouter
