import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

import type { AppRouter } from '@/trpc/root'
import { appRouter } from '@/trpc/root'
import { createCallerFactory, createTRPCContext } from './trpc'

const createCaller = createCallerFactory(appRouter)

type RouterInputs = inferRouterInputs<AppRouter>
type RouterOutputs = inferRouterOutputs<AppRouter>

export { createTRPCContext, appRouter, createCaller }
export type { AppRouter, RouterInputs, RouterOutputs }

export * from './auth'