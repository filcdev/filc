import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'

import type { PermissionType } from '@filc/rbac'
import { validateToken } from '@filc/auth'
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

  const end = Date.now()
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`)

  return result
})

export const publicProcedure = t.procedure.use(timingMiddleware)

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

export const permissionProtectedProcedureFactory = (
  permissions: PermissionType[]
) => {
  return t.procedure
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
    .use(async ({ ctx, next }) => {
      const authorized = await ctx.authorize(permissions)
      if (!authorized) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      return next()
    })
}
