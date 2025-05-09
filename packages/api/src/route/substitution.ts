import { createTRPCRouter, protectedProcedure } from "@/trpc";
import { db } from "../../../db/src/index"
import { z } from "zod";
import { substitution } from "../../../db/src/schema/timetable"
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

// TODO: Do the role based access once that is implmented (or something simmilar.).
export const substitutionRouter = createTRPCRouter({
    create: protectedProcedure
    .input(z.object({
        lesson: z.string(),
        teacher: z.string()
    }))
    .mutation(async ({ctx, input}) => {
        try {
            await db.insert(substitution).values(input)
        } catch (error) {
            throw new TRPCError({message: "Failed to create substitution.", code: "INTERNAL_SERVER_ERROR"})
        }
    }),

    update: protectedProcedure
    .input(z.object({
        teacher: z.string(),
    }))
    .mutation(async ({ctx, input}) => {
        try {
            await db.update(substitution).set(input)
        } catch (error) {
            throw new TRPCError({message: "Failed to update substitute teacher.", code: "INTERNAL_SERVER_ERROR"})
        }
    }),
    
    delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ctx, input}) => {
        try {
            await db.delete(substitution).where(eq(substitution.id, input)).returning()
        } catch (error) {
            throw new TRPCError({message: "Failed to delete substitution.", code: "INTERNAL_SERVER_ERROR"})
        }
    }),
    
    getByLesson: protectedProcedure
    .input(z.string())
    .mutation(async ({ctx, input}) => {
        try {
            await db
            .select()
            .from(substitution)
            .where(eq(substitution.lesson, input))
            .limit(1)
            
            // TODO: Maybe join this later?
        } catch (error) {
            throw new TRPCError({message: "Failed to get substitution for lesson.", code: "INTERNAL_SERVER_ERROR"})
        }
    }),
    
    getByTeacher: protectedProcedure
    .input(z.string())
    .mutation(async ({ctx, input}) => {
        try {
            await db
            .select()
            .from(substitution)
            .where(eq(substitution.teacher, input))            
            
            // TODO: Maybe join this later?
        } catch (error) {
            throw new TRPCError({message: "Failed to get substitutions for teacher.", code: "INTERNAL_SERVER_ERROR"})
        }
    }),
})