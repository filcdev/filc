import { auth } from '@filc/auth'
import { appConfig } from '@filc/config'
import { createLogger } from '@filc/log'
import { TRPCError, initTRPC } from '@trpc/server'
import type { Context } from 'hono'
import superjson from 'superjson'
import { ZodError } from 'zod'

const logger = createLogger('trpc')

export type Variables = {
  user: typeof auth.$Infer.Session.user | null
  session: typeof auth.$Infer.Session.session | null
}

// @see https://trpc.io/docs/server/context
export const createContext = (
  _opts: {
    req: Request
    resHeaders: Headers
  },
  honoCtx: Context<{
    Variables: Variables
  }>
) => {
  const session = honoCtx.get('session')
  const user = honoCtx.get('user')

  return {
    user,
    session,
    logger,
    auth,
    req: _opts.req,
  }
}

const t = initTRPC.context<typeof createContext>().create({
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

  if (appConfig.env === 'development') {
    const delay = Math.floor(Math.random() * 1000) + 200
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  const result = await next()

  const end = Date.now()
  logger.info(
    {
      path,
      duration: end - start,
      ok: result.ok,
    },
    'trpc.request'
  )

  return result
})

export const publicProcedure = t.procedure.use(timingMiddleware)

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  return next({
    ctx: {
      session: ctx.session,
      user: ctx.user,
    },
  })
})
