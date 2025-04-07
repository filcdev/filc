import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'

import type { PermissionType } from '@filc/rbac'
import { validateToken } from '@filc/auth'
import { backendConfig } from '@filc/config'
import { prisma } from '@filc/db'
import { hasAnyPermission } from '@filc/rbac'

export const createTRPCContext = async ({
  req
}: CreateExpressContextOptions) => {
  const sessionData = await validateToken(
    req.headers['x-filc-authtok'] as string
  )
  const session = sessionData?.session ?? null
  const user = sessionData?.user ?? null

  return {
    session,
    user,
    prisma,
    req,
    authorize: async (permissions: PermissionType[]) => {
      if (!user) return false
      return hasAnyPermission(user, permissions)
    }
  }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null
    }
  })
})

export const createCallerFactory = t.createCallerFactory

export const createTRPCRouter = t.router

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now()

  const result = await next()

  // add delay in dev
  if (t._config.isDev) {
    const delay = Math.floor(Math.random() * 1000)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  const end = Date.now()
  console.log(`⏲️ ${path} took ${end - start}ms to execute`)

  return result
})

export const publicProcedure = t.procedure.use(timingMiddleware)

/**
 * CSRF protection middleware for mutation procedures
 * Checks that the request has the proper origin and referer headers
 */
const csrfMiddleware = t.middleware(({ ctx, next }) => {
  // In development mode, skip CSRF checks
  if (t._config.isDev) {
    return next({ ctx })
  }

  const { req } = ctx

  const origin = req.headers.origin
  const referer = req.headers.referer

  const appHost = backendConfig.url

  if (!origin || !referer) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Missing required headers for CSRF protection'
    })
  }

  // Check if the origin and referer are from our app
  try {
    const originHost = new URL(origin).host
    const refererHost = new URL(referer).host

    if (originHost !== appHost || refererHost !== appHost) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Invalid request origin'
      })
    }
  } catch (error) {
    console.error(error)
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Invalid request headers'
    })
  }

  return next({
    ctx: {
      session: ctx.session,
      user: ctx.user,
      prisma: ctx.prisma,
      authorize: ctx.authorize
    }
  })
})

// Protected procedures - require authentication and include CSRF protection
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session || !ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({
      ctx: {
        session: ctx.session,
        user: ctx.user,
        prisma: ctx.prisma,
        authorize: ctx.authorize
      }
    })
  })
  .use(csrfMiddleware)

// Mutation procedures that need CSRF protection but don't require authentication
export const protectedPublicMutation = publicProcedure.use(csrfMiddleware)

export const permissionProtectedProcedureFactory = (
  permissions: PermissionType[],
  additionalChecks?: {
    verified?: boolean
    onboarded?: boolean
  }
) => {
  return t.procedure
    .use(timingMiddleware)
    .use(({ ctx, next }) => {
      if (
        !ctx.session ||
        !ctx.user ||
        (additionalChecks?.verified && !ctx.user.isEmailVerified) ||
        (additionalChecks?.onboarded && !ctx.user.isOnboarded)
      ) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }
      return next({
        ctx: {
          session: ctx.session,
          user: ctx.user,
          prisma: ctx.prisma,
          authorize: ctx.authorize
        }
      })
    })
    .use(async ({ ctx, next }) => {
      const authorized = await ctx.authorize(permissions)
      if (!authorized) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      return next({
        ctx: {
          session: ctx.session,
          user: ctx.user,
          prisma: ctx.prisma,
          authorize: ctx.authorize
        }
      })
    })
}
