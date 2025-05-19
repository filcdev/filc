import { db } from "@filc/db";
import { substitution } from "@filc/db/schema/timetable.ts";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const substitutionRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        lessonId: z.string(),
        teacherId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        await db.insert(substitution).values(input);
      } catch (_error) {
        throw new TRPCError({
          message: "Failed to create substitution.",
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
    .mutation(async ({ input }) => {
      try {
        await db.update(substitution).set(input);
      } catch (_error) {
        throw new TRPCError({
          message: "Failed to update substitute teacher.",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    }),

  delete: protectedProcedure.input(z.string()).mutation(async ({ input }) => {
    try {
      await db
        .delete(substitution)
        .where(eq(substitution.id, input))
        .returning();
    } catch (_error) {
      throw new TRPCError({
        message: "Failed to delete substitution.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  }),

  getByLesson: protectedProcedure
    .input(z.string())
    .mutation(async ({ input }) => {
      try {
        await db
          .select()
          .from(substitution)
          .where(eq(substitution.lessonId, input))
          .limit(1);

        // TODO: Maybe join this later?
      } catch (_error) {
        throw new TRPCError({
          message: "Failed to get substitution for lesson.",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    }),

  getByTeacher: protectedProcedure
    .input(z.string())
    .mutation(async ({ input }) => {
      try {
        await db
          .select()
          .from(substitution)
          .where(eq(substitution.teacherId, input));

        // TODO: Maybe join this later?
      } catch (_error) {
        throw new TRPCError({
          message: "Failed to get substitutions for teacher.",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    }),
});
