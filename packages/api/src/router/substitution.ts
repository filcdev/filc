import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { Permission } from '@filc/rbac'

import {
  createTRPCRouter,
  permissionProtectedProcedureFactory,
  publicProcedure
} from '../trpc'

export const substitutionRouter = createTRPCRouter({
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.prisma.substitution.findMany()
  }),

  getOwn: permissionProtectedProcedureFactory([Permission.VIEW_SUBSTITUTIONS], {
    verified: true,
    onboarded: true
  }).query(({ ctx }) => {
    if (!ctx.user.classId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'User does not have a classId, how did you get here?'
      })
    }

    return ctx.prisma.substitution.findMany({
      where: {
        classId: ctx.user.classId
      }
    })
  }),

  create: permissionProtectedProcedureFactory([Permission.CREATE_SUBSTITUTIONS])
    .input(
      z.object({
        consolidated: z.boolean(),
        date: z.date(),
        classId: z.string().cuid(),
        teacherId: z.string().cuid(),
        subjectId: z.string().cuid(),
        lessonId: z.string().cuid(),
        missingTeacherId: z.string().cuid(),
        roomId: z.string().cuid()
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.substitution.create({
        data: {
          consolidated: input.consolidated,
          date: input.date,
          classId: input.classId,
          teacherId: input.teacherId,
          subjectId: input.subjectId,
          lessonId: input.lessonId,
          missingTeacherId: input.missingTeacherId,
          roomId: input.roomId
        }
      })
    }),

  update: permissionProtectedProcedureFactory([Permission.UPDATE_SUBSTITUTIONS])
    .input(
      z.object({
        id: z.string().cuid(),
        consolidated: z.boolean(),
        date: z.date(),
        classId: z.string().cuid(),
        teacherId: z.string().cuid(),
        subjectId: z.string().cuid(),
        lessonId: z.string().cuid(),
        missingTeacherId: z.string().cuid(),
        roomId: z.string().cuid()
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.substitution.update({
        where: {
          id: input.id
        },
        data: {
          consolidated: input.consolidated,
          date: input.date,
          classId: input.classId,
          teacherId: input.teacherId,
          subjectId: input.subjectId,
          lessonId: input.lessonId,
          missingTeacherId: input.missingTeacherId,
          roomId: input.roomId
        }
      })
    }),
  delete: permissionProtectedProcedureFactory([Permission.DELETE_SUBSTITUTIONS])
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.substitution.delete({
        where: {
          id: input.id
        }
      })
    })
})
