import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { Permission } from '@filc/rbac'
import { login, loginSchema, logout, register, registerSchema } from '@filc/auth'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'

export const authRouter = createTRPCRouter({
  login: publicProcedure
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

  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
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

  getSession: publicProcedure
    .query(({ ctx }) => {
      return ctx.session
    }),

  // Role Management
  assignRole: protectedProcedure
    .input(z.object({
      userId: z.string(),
      roleId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!await ctx.authorize([Permission.MANAGE_PERMISSIONS])) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        })
      }

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

  removeRole: protectedProcedure
    .input(z.object({
      userId: z.string(),
      roleId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!await ctx.authorize([Permission.MANAGE_PERMISSIONS])) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        })
      }

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

  // Permission Management
  grantPermission: protectedProcedure
    .input(z.object({
      userId: z.string(),
      permissionId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!await ctx.authorize([Permission.MANAGE_PERMISSIONS])) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        })
      }

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

  revokePermission: protectedProcedure
    .input(z.object({
      userId: z.string(),
      permissionId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!await ctx.authorize([Permission.MANAGE_PERMISSIONS])) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        })
      }

      return ctx.prisma.userPermission.delete({
        where: {
          userId_permissionId: {
            userId: input.userId,
            permissionId: input.permissionId
          }
        }
      })
    }),

  // Role Listing
  getRoles: protectedProcedure
    .query(async ({ ctx }) => {
      if (!await ctx.authorize([Permission.VIEW_ROLES])) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        })
      }

      return ctx.prisma.role.findMany({
        include: {
          permissions: true
        }
      })
    }),

  getSecretMessage: protectedProcedure.query(() => {
    return 'You are authenticated!'
  })
})
