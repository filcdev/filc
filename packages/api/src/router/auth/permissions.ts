import { z } from 'zod'

import { Permission } from '@filc/rbac'

import {
  createTRPCRouter,
  permissionProtectedProcedureFactory,
  protectedProcedure
} from '../../trpc'

export const permissionsRouter = createTRPCRouter({
  assignRole: permissionProtectedProcedureFactory([
    Permission.MANAGE_PERMISSIONS
  ])
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

  removeRole: permissionProtectedProcedureFactory([
    Permission.MANAGE_PERMISSIONS
  ])
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

  grantPermission: permissionProtectedProcedureFactory([
    Permission.MANAGE_PERMISSIONS
  ])
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

  revokePermission: permissionProtectedProcedureFactory([
    Permission.MANAGE_PERMISSIONS
  ])
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
  })
})
