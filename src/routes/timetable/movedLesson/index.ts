import { sql, eq, gte, and } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { HTTPException } from "hono/http-exception";
import { db } from "~/database";
import {
  movedLesson,
  movedLessonLessonMTM,
  lesson,
  period,
  dayDefinition,
  classroom,
  lessonCohortMTM,
} from "~/database/schema/timetable";
import type { SuccessResponse } from "~/utils/globals";
import { timetableFactory } from "../_factory";
import {
  requireAuthentication,
  requireAuthorization,
} from "~/utils/middleware";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["chronos", "substitutions"]);

export const getAllMovedLessons = timetableFactory.createHandlers(async (c) => {
  try {
    const movedLessons = await db
      .select({
        movedLesson,
        period,
        dayDefinition,
        classroom,
        lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(${movedLessonLessonMTM.lessonId}) FILTER (WHERE ${movedLessonLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as("lessons"),
      })
      .from(movedLesson)
      .leftJoin(period, eq(movedLesson.startingPeriod, period.id))
      .leftJoin(dayDefinition, eq(movedLesson.startingDay, dayDefinition.id))
      .leftJoin(classroom, eq(movedLesson.room, classroom.id))
      .leftJoin(
        movedLessonLessonMTM,
        eq(movedLesson.id, movedLessonLessonMTM.movedLessonId),
      )
      .groupBy(movedLesson.id, period.id, dayDefinition.id, classroom.id);

    return c.json<SuccessResponse>({
      success: true,
      data: movedLessons,
    });
  } catch (error) {
    logger.error("Error while fetching all moved lessons", { error });
    throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
      message: "Failed to fetch all moved lessons",
    });
  }
});

export const getRelevantMovedLessons = timetableFactory.createHandlers(
  async (c) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr: string = today.toISOString().split("T")[0]!;

      const movedLessons = await db
        .select({
          movedLesson,
          period,
          dayDefinition,
          classroom,
          lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(${movedLessonLessonMTM.lessonId}) FILTER (WHERE ${movedLessonLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as("lessons"),
        })
        .from(movedLesson)
        .leftJoin(period, eq(movedLesson.startingPeriod, period.id))
        .leftJoin(dayDefinition, eq(movedLesson.startingDay, dayDefinition.id))
        .leftJoin(classroom, eq(movedLesson.room, classroom.id))
        .leftJoin(
          movedLessonLessonMTM,
          eq(movedLesson.id, movedLessonLessonMTM.movedLessonId),
        )
        .where(gte(movedLesson.date, todayStr))
        .groupBy(movedLesson.id, period.id, dayDefinition.id, classroom.id);

      return c.json<SuccessResponse>({
        success: true,
        data: movedLessons,
      });
    } catch (error) {
      logger.error("Error while fetching relevant moved lessons", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to fetch relevant moved lessons",
      });
    }
  },
);

export const getMovedLessonsForCohort = timetableFactory.createHandlers(
  async (c) => {
    try {
      const cohortId = c.req.param("cohortId");

      if (!cohortId) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: "Cohort ID is required",
        });
      }

      const movedLessons = await db
        .select({
          movedLesson,
          period,
          dayDefinition,
          classroom,
          lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(DISTINCT ${movedLessonLessonMTM.lessonId}) FILTER (WHERE ${movedLessonLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as("lessons"),
        })
        .from(movedLesson)
        .leftJoin(period, eq(movedLesson.startingPeriod, period.id))
        .leftJoin(dayDefinition, eq(movedLesson.startingDay, dayDefinition.id))
        .leftJoin(classroom, eq(movedLesson.room, classroom.id))
        .leftJoin(
          movedLessonLessonMTM,
          eq(movedLesson.id, movedLessonLessonMTM.movedLessonId),
        )
        .leftJoin(lesson, eq(movedLessonLessonMTM.lessonId, lesson.id))
        .leftJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
        .where(eq(lessonCohortMTM.cohortId, cohortId))
        .groupBy(movedLesson.id, period.id, dayDefinition.id, classroom.id);

      return c.json<SuccessResponse>({
        success: true,
        data: movedLessons,
      });
    } catch (error) {
      logger.error("Error while fetching moved lessons for cohort", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to fetch moved lessons for cohort",
      });
    }
  },
);

export const getRelevantMovedLessonsForCohort = timetableFactory.createHandlers(
  async (c) => {
    try {
      const cohortId = c.req.param("cohortId");

      if (!cohortId) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: "Cohort ID is required",
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr: string = today.toISOString().split("T")[0]!;

      const movedLessons = await db
        .select({
          movedLesson,
          period,
          dayDefinition,
          classroom,
          lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(DISTINCT ${movedLessonLessonMTM.lessonId}) FILTER (WHERE ${movedLessonLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as("lessons"),
        })
        .from(movedLesson)
        .leftJoin(period, eq(movedLesson.startingPeriod, period.id))
        .leftJoin(dayDefinition, eq(movedLesson.startingDay, dayDefinition.id))
        .leftJoin(classroom, eq(movedLesson.room, classroom.id))
        .leftJoin(
          movedLessonLessonMTM,
          eq(movedLesson.id, movedLessonLessonMTM.movedLessonId),
        )
        .leftJoin(lesson, eq(movedLessonLessonMTM.lessonId, lesson.id))
        .leftJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
        .where(
          and(
            eq(lessonCohortMTM.cohortId, cohortId),
            gte(movedLesson.date, todayStr),
          ),
        )
        .groupBy(movedLesson.id, period.id, dayDefinition.id, classroom.id);

      return c.json<SuccessResponse>({
        success: true,
        data: movedLessons,
      });
    } catch (error) {
      logger.error("Error while fetching relevant moved lessons for cohort", {
        error,
      });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to fetch relevant moved lessons for cohort",
      });
    }
  },
);

export const createMovedLesson = timetableFactory.createHandlers(
  requireAuthentication,
  requireAuthorization("movedLesson:create"),
  async (c) => {
    try {
      const body = await c.req.json();
      const { startingPeriod, startingDay, room, date, lessonIds } = body;

      if (!date) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: "Date is required",
        });
      }

      const [newMovedLesson] = await db
        .insert(movedLesson)
        .values({
          id: crypto.randomUUID(),
          startingPeriod: startingPeriod,
          startingDay: startingDay,
          room: room,
          date,
        })
        .returning();

      if (
        lessonIds &&
        Array.isArray(lessonIds) &&
        lessonIds.length > 0 &&
        newMovedLesson
      ) {
        await db.insert(movedLessonLessonMTM).values(
          lessonIds.map((lessonId: string) => ({
            movedLessonId: newMovedLesson.id,
            lessonId,
          })),
        );
      }

      return c.json<SuccessResponse>(
        {
          success: true,
          data: newMovedLesson,
        },
        StatusCodes.CREATED,
      );
    } catch (error) {
      logger.error(`Error while creating moved lesson: ${error}`);
      throw error;
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to create moved lesson",
      });
    }
  },
);

export const updateMovedLesson = timetableFactory.createHandlers(
  requireAuthentication,
  requireAuthorization("movedLesson:delete"),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const { startingPeriod, startingDay, room, date, lessonIds } = body;

      if (!id) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: "Moved lesson ID is required",
        });
      }

      const [updatedMovedLesson] = await db
        .update(movedLesson)
        .set({
          startingPeriod:
            startingPeriod !== undefined ? startingPeriod : undefined,
          startingDay: startingDay !== undefined ? startingDay : undefined,
          room: room !== undefined ? room : undefined,
          date: date !== undefined ? date : undefined,
        })
        .where(eq(movedLesson.id, id))
        .returning();

      if (!updatedMovedLesson) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: "Moved lesson not found",
        });
      }

      if (lessonIds !== undefined && Array.isArray(lessonIds)) {
        await db
          .delete(movedLessonLessonMTM)
          .where(eq(movedLessonLessonMTM.movedLessonId, id));

        if (lessonIds.length > 0) {
          await db.insert(movedLessonLessonMTM).values(
            lessonIds.map((lessonId: string) => ({
              movedLessonId: id,
              lessonId,
            })),
          );
        }
      }

      return c.json<SuccessResponse>({
        success: true,
        data: updatedMovedLesson,
      });
    } catch (error) {
      logger.error("Error while updating moved lesson", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to update moved lesson",
      });
    }
  },
);

export const deleteMovedLesson = timetableFactory.createHandlers(
  requireAuthorization("movedLesson:delete"),
  async (c) => {
    try {
      const id = c.req.param("id");

      if (!id) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: "Moved lesson ID is required",
        });
      }

      const [deletedMovedLesson] = await db
        .delete(movedLesson)
        .where(eq(movedLesson.id, id))
        .returning();

      if (!deletedMovedLesson) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: "Moved lesson not found",
        });
      }

      return c.json<SuccessResponse>({
        success: true,
        data: deletedMovedLesson,
      });
    } catch (error) {
      logger.error("Error while deleting moved lesson", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to delete moved lesson",
      });
    }
  },
);
