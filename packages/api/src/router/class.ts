import { z } from 'zod'

import { Permission } from '@filc/rbac'

import {
  createTRPCRouter,
  permissionProtectedProcedureFactory,
  publicProcedure
} from '../trpc'

export const classRouter = createTRPCRouter({
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.prisma.class.findMany()
  }),
  create: permissionProtectedProcedureFactory([Permission.CREATE_CLASSES])
    .input(
      z.object({
        name: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.class.create({
        data: {
          name: input.name
        }
      })
    })
})
