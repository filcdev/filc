import { cohortRouter } from '../route/cohort.ts'
import { pingRouter } from '../route/ping'
import { substitutionRouter } from '../route/substitution.ts'
import { createTRPCRouter } from './index.ts'

export const appRouter = createTRPCRouter({
  ping: pingRouter,
  substitution: substitutionRouter,
  cohort: cohortRouter,
})

export type AppRouter = typeof appRouter
