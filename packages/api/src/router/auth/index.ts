import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  completeOnboarding,
  completeOnboardingSchema,
  login,
  loginSchema,
  logout,
  refreshAccessToken,
  refreshTokenSchema,
  register,
  registerSchema,
  resendVerification,
  verifyEmail,
  verifyEmailSchema
} from '@filc/auth'

import {
  createTRPCRouter,
  protectedProcedure,
  protectedPublicMutation,
  publicProcedure
} from '../../trpc'

// TODO: Add endpoints for password reset functionality

export const authRouter = createTRPCRouter({
  login: protectedPublicMutation
    .input(loginSchema)
    .mutation(async ({ input }) => {
      const result = await login(input)
      if ('code' in result) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: result.message
        })
      }
      return result
    }),

  register: protectedPublicMutation
    .input(registerSchema)
    .mutation(async ({ input }) => {
      const result = await register(input)
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
      return result
    }),

  verifyEmail: protectedPublicMutation
    .input(verifyEmailSchema)
    .mutation(async ({ input }) => {
      const result = await verifyEmail(input.token)
      if ('code' in result) {
        if (result.code === 'auth/verification-failed') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.message
          })
        } else if (result.code === 'auth/already-verified') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: result.message
          })
        } else {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.message
          })
        }
      }
      return result
    }),

  resendVerification: protectedPublicMutation
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const result = await resendVerification(input.email)
      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.message
        })
      }
      return result
    }),

  completeOnboarding: protectedProcedure
    .input(completeOnboardingSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Kérlek jelentkezz be a folytatáshoz'
        })
      }

      const result = await completeOnboarding(ctx.user.id, input)
      if ('code' in result) {
        if (result.code === 'auth/user-exists') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: result.message
          })
        } else if (result.code === 'auth/invalid-class') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.message
          })
        } else if (result.code === 'auth/not-verified') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: result.message
          })
        } else {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.message
          })
        }
      }
      return result
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const { session } = ctx

      if (!session) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No session found'
        })
      }

      const result = await logout(session.id)
      return { success: result }
    } catch (_error) {
      console.error(_error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to logout'
      })
    }
  }),

  getSession: publicProcedure.query(({ ctx }) => {
    return {
      user: ctx.user,
      session: ctx.session
    }
  }),

  refresh: protectedPublicMutation
    .input(refreshTokenSchema)
    .mutation(async ({ input }) => {
      const result = await refreshAccessToken(input)

      if ('code' in result) {
        // Handle different error types
        if (result.code === 'auth/invalid-token') {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: result.message
          })
        } else {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.message
          })
        }
      }
      return result
    })

  // TODO: Implement requestPasswordReset endpoint

  // TODO: Implement resetPassword endpoint
})
