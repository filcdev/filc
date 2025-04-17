import { TRPCError, initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'

import type { Session } from 'better-auth'
import { auth } from './auth'
import { db } from './db'

// @see https://trpc.io/docs/server/context
export const createTRPCContext = async (opts: {
  headers: Headers
  session: Session | null
}) => {
  const session = await auth.api.getSession({
    headers: opts.headers,
  })

  return {
    session,
    db,
  }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
})

export const createCallerFactory = t.createCallerFactory

export const createTRPCRouter = t.router

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now()

  if (t._config.isDev) {
    const delay = Math.floor(Math.random() * 1000) + 200
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  const result = await next()

  const end = Date.now()
  console.log(`[${path}] OK: ${result.ok}, took ${end - start}ms`)

  return result
})

export const publicProcedure = t.procedure.use(timingMiddleware)

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  })
})
