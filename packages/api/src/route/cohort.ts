import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@filc/db";
import { cohort } from "@filc/db/schema/timetable.js";
import { eq } from "drizzle-orm";

export const cohortRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        designation: z.string(),
        classMasterId: z.string(),
        secondaryClassMasterId: z.string(),
        headquartersRoomId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const hasPermission = await ctx.auth.api.hasPermission({
          headers: ctx.req.headers,
          body: {
            permissions: {
              cohort: ["create"],
            },
          },
        });

        if (!hasPermission.success) {
          ctx.logger.error(`Failed to create cohort: ${hasPermission.error}`);

          throw new TRPCError({
            message: "You do not have permission to create a cohort.",
            code: "FORBIDDEN",
          });
        }

        if (input.designation.length != 3) {
          throw new TRPCError({
            message: "Designation length must be 3.",
            code: "BAD_REQUEST",
          });
        }

        await db.insert(cohort).values(input);
      } catch (error) {
        const msg = "Failed to create cohort.";

        ctx.logger.error(`${msg}: ${error}`);

        throw new TRPCError({
          message: msg,
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    }),
  get: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    try {
      const hasPermission = await ctx.auth.api.hasPermission({
        headers: ctx.req.headers,
        body: {
          permissions: {
            cohort: ["read"],
          },
        },
      });

      if (!hasPermission.success) {
        ctx.logger.error(`Failed to get cohort: ${hasPermission.error}`);

        throw new TRPCError({
          message: "You do not have permission to get a cohort.",
          code: "FORBIDDEN",
        });
      }

      return await db
        .select()
        .from(cohort)
        .where(eq(cohort.id, input))
        .limit(1);
    } catch (error) {
      const msg = "Failed to create cohort.";

      ctx.logger.error(`${msg}: ${error}`);

      throw new TRPCError({
        message: msg,
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  }),
});
