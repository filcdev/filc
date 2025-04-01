import { authRouter } from './router/auth'
import { permissionsRouter } from './router/auth/permissions'
import { substitutionRouter } from './router/substitution'
import { classRouter } from './router/class'
import { createTRPCRouter } from './trpc'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  class: classRouter,
  permission: permissionsRouter,
  substitution: substitutionRouter,
})

export type AppRouter = typeof appRouter
