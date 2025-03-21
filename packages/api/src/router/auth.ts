import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  login,
  loginSchema,
  logout,
  register,
  registerSchema
} from '@filc/auth'
import { Permission } from '@filc/rbac'

import { createTRPCRouter, permissionProtectedProcedureFactory, protectedProcedure, publicProcedure } from '../trpc'

export const authRouter = createTRPCRouter({
  login: publicProcedure.input(loginSchema).mutation(async ({ input }) => {
    const result = await login(input)
    if ('code' in result) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: result.message
      })
    }
    return result
  }),

  register: publicProcedure
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

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const { session } = ctx
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

  assignRole: permissionProtectedProcedureFactory([Permission.MANAGE_PERMISSIONS])
    .input(
      z.object({
        userId: z.string(),
        roleId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: {
          roles: {
            connect: { id: input.roleId }
          }
        },
        include: {
          roles: {
            include: {
              permissions: true
            }
          }
        }
      })
    }),

  removeRole: permissionProtectedProcedureFactory([Permission.MANAGE_PERMISSIONS])
    .input(
      z.object({
        userId: z.string(),
        roleId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: {
          roles: {
            disconnect: { id: input.roleId }
          }
        },
        include: {
          roles: {
            include: {
              permissions: true
            }
          }
        }
      })
    }),

  grantPermission: permissionProtectedProcedureFactory([Permission.MANAGE_PERMISSIONS])
    .input(
      z.object({
        userId: z.string(),
        permissionId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userPermission.create({
        data: {
          userId: input.userId,
          permissionId: input.permissionId,
          granted: true
        },
        include: {
          permission: true
        }
      })
    }),

  revokePermission: permissionProtectedProcedureFactory([Permission.MANAGE_PERMISSIONS])
    .input(
      z.object({
        userId: z.string(),
        permissionId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.userPermission.delete({
        where: {
          userId_permissionId: {
            userId: input.userId,
            permissionId: input.permissionId
          }
        }
      })
    }),

  getRoles: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.role.findMany({
      include: {
        permissions: true
      }
    })
  }),
})
