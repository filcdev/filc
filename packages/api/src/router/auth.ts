import { TRPCError } from '@trpc/server'

import type { AuthError, AuthResult } from '@filc/auth'
import { login, loginSchema, register, registerSchema } from '@filc/auth'

import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'

export const authRouter = createTRPCRouter({
  login: publicProcedure.input(loginSchema).mutation(async ({ input }) => {
    const result = (await login(input)) as AuthResult | AuthError

    // Handle error responses
    if ('code' in result) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: result.message
      })
    }

    return result as AuthResult
  }),

  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input }) => {
      const result = (await register(input)) as AuthResult | AuthError

      // Handle error responses
      if ('code' in result) {
        if (result.code === 'auth/user-exists') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: result.message
          })
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.message
          })
        }
      }

      return result as AuthResult
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Get session ID from context
      const { session } = ctx
      if (!session) {
        throw new Error('No active session')
      }

      // Call logout function from auth package
      await import('@filc/auth').then(({ logout }) =>
        logout(session.id as string)
      )

      return { success: true }
    } catch (_error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to logout'
      })
    }
  }),
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session
  }),
  getSecretMessage: protectedProcedure.query(() => {
    return 'You are authenticated!'
  })
})
