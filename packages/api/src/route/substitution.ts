import { db } from '@filc/db'
import { substitution } from '@filc/db/schema/timetable'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'

export const substitutionRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        lessonId: z.string(),
        teacherId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const hasPermission = await ctx.auth.api.hasPermission({
          headers: ctx.req.headers,
          body: {
            permissions: {
              substitution: ["create"],
            },
          },
        });

        if (!hasPermission.success) {
          ctx.logger.error(
            `Failed to create substitution: ${hasPermission.error}`,
          );

          throw new TRPCError({
            message: "You do not have permission to create a substitution.",
            code: "FORBIDDEN",
          });
        }

        const existingSubstitution = await db
          .select()
          .from(substitution)
          .where(eq(substitution.lessonId, input.lessonId))
          .limit(1);

        if (!existingSubstitution) {
          await db.insert(substitution).values(input);
        } else {
          throw new TRPCError({
            message: "There is already a substitution for that lesson.",
            code: "INTERNAL_SERVER_ERROR",
          });
        }
      } catch (error) {
        const msg = "Failed to create substitution";

        ctx.logger.error(`${msg}: ${error}`);

        throw new TRPCError({
          message: msg,
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        teacherId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await db.update(substitution).set(input);
      } catch (error) {
        const msg = "Failed to update substitute teacher.";

        ctx.logger.error(`${msg}: ${error}`);

        throw new TRPCError({
          message: msg,
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ input, ctx }) => {
      try {
        await db
          .delete(substitution)
          .where(eq(substitution.id, input))
          .returning();
      } catch (error) {
        const msg = "Failed to delete substitution.";

        ctx.logger.error(`${msg}: ${error}`);

        throw new TRPCError({
          message: msg,
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    }),

  getByLesson: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      try {
        await db
          .select()
          .from(substitution)
          .where(eq(substitution.lessonId, input))
          .limit(1);

        // TODO: Maybe join this later?
      } catch (error) {
        const msg = "Failed to get substitution for lesson.";

        ctx.logger.error(`${msg}: ${error}`);

        throw new TRPCError({
          message: msg,
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    }),

  getByTeacher: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      try {
        return await db
          .select()
          .from(substitution)
          .where(eq(substitution.teacherId, input));

        // TODO: Maybe join this later?
      } catch (error) {
        const msg = "Failed to get substitutions for teacher.";

        ctx.logger.error(`${msg}: ${error}`);

        throw new TRPCError({
          message: "Failed to get substitutions for teacher.",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    }),
});
