import { authRouter } from './router/auth'
import { permissionsRouter } from './router/auth/permissions'
import { classRouter } from './router/class'
import { substitutionRouter } from './router/substitution'
import { createTRPCRouter } from './trpc'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  class: classRouter,
  permission: permissionsRouter,
  substitution: substitutionRouter
})

export type AppRouter = typeof appRouter
