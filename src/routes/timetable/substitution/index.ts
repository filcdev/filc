import { getLogger } from "@logtape/logtape";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import z from "zod";
import { db } from "~/database";
import {
  cohort,
  lesson,
  lessonCohortMTM,
  substitution,
  substitutionLessonMTM,
  teacher,
} from "~/database/schema/timetable";
import { env } from "~/utils/environment";
import type { SuccessResponse } from "~/utils/globals";
import {
  requireAuthentication,
  requireAuthorization,
} from "~/utils/middleware";
import { ensureJsonSafeDates } from "~/utils/zod";
import { timetableFactory } from "../_factory";

const logger = getLogger(["chronos", "substitutions"]);

const substitutionSchema = createSelectSchema(substitution);

const allResponseSchema = z.object({
  data: z.array(substitutionSchema),
  success: z.boolean(),
});

export const getAllSubstitutions = timetableFactory.createHandlers(
  describeRoute({
    description: "Get all substitutions from the database.",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(allResponseSchema)),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Substitution"],
  }),
  requireAuthentication,
  async (c) => {
    try {
      const substitutions = await db
        .select({
          lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(${substitutionLessonMTM.lessonId}) FILTER (WHERE ${substitutionLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as("lessons"),
          substitution,
          teacher,
        })
        .from(substitution)
        .leftJoin(teacher, eq(substitution.substituter, teacher.id))
        .leftJoin(
          substitutionLessonMTM,
          eq(substitution.id, substitutionLessonMTM.substitutionId),
        )
        .groupBy(substitution.id, teacher.id);

      return c.json<SuccessResponse>({
        data: substitutions,
        success: true,
      });
    } catch (error) {
      logger.error("Error while fetching all substitutions", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to fetch all substitutions",
      });
    }
  },
);

export const getRelevantSubstitutions = timetableFactory.createHandlers(
  describeRoute({
    description: "Get relevant substitutions from the database.",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(allResponseSchema)),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Substitution"],
  }),
  requireAuthentication,
  async (c) => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const substitutions = await db
        .select({
          lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(${substitutionLessonMTM.lessonId}) FILTER (WHERE ${substitutionLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as("lessons"),
          substitution,
          teacher,
        })
        .from(substitution)
        .leftJoin(teacher, eq(substitution.substituter, teacher.id))
        .leftJoin(
          substitutionLessonMTM,
          eq(substitution.id, substitutionLessonMTM.substitutionId),
        )
        .where(gte(substitution.date, today as string))
        .groupBy(substitution.id, teacher.id);

      return c.json<SuccessResponse>({
        data: substitutions,
        success: true,
      });
    } catch (error) {
      logger.error("Error while fetching substitutions", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to fetch substitutions",
      });
    }
  },
);

export const getRelevantSubstitutionsForCohort =
  timetableFactory.createHandlers(
    describeRoute({
      description:
        "Get relevant substitutions for a given cohort from the database.",
      parameters: [
        {
          in: "path",
          name: "cohortId",
          required: true,
          schema: {
            description: "The unique identifier for the cohort.",
            type: "string",
          },
        },
      ],
      responses: {
        200: {
          content: {
            "application/json": {
              schema: resolver(ensureJsonSafeDates(allResponseSchema)),
            },
          },
          description: "Successful Response",
        },
      },
      tags: ["Substitution"],
    }),
    requireAuthentication,
    async (c) => {
      const cohortId = c.req.param("cohortId");

      if (!cohortId) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: "Cohort ID is required",
        });
      }

      const today = new Date().toISOString().split("T")[0];

      try {
        const substitutions = await db
          .select({
            lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(${substitutionLessonMTM.lessonId}) FILTER (WHERE ${substitutionLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as("lessons"),
            substitution,
            teacher,
          })
          .from(substitution)
          .leftJoin(teacher, eq(substitution.substituter, teacher.id))
          .leftJoin(
            substitutionLessonMTM,
            eq(substitution.id, substitutionLessonMTM.substitutionId),
          )
          .leftJoin(lesson, eq(substitutionLessonMTM.lessonId, lesson.id))
          .leftJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
          .leftJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
          .where(
            and(
              gte(substitution.date, today as string),
              eq(cohort.id, cohortId),
            ),
          )
          .groupBy(substitution.id, teacher.id);

        return c.json<SuccessResponse>({
          data: {
            cohortId,
            substitutions,
          },
          success: true,
        });
      } catch (error) {
        logger.error("Error while fetching substitutions for cohort", {
          error,
        });
        throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
          message: "Failed to fetch substitutions for cohort",
        });
      }
    },
  );

const createSchema = (
  await resolver(
    ensureJsonSafeDates(
      z.object({
        date: z.date(),
        lessonIds: z.string().array(),
        substituter: z.string().nullable(),
      }),
    ),
  ).toOpenAPISchema()
).schema;

const createResponseSchema = z.object({
  data: substitutionSchema,
  success: z.boolean(),
});

export const createSubstitution = timetableFactory.createHandlers(
  describeRoute({
    description: "Create a new substitution",
    requestBody: {
      content: {
        "multipart/form-data": {
          schema: createSchema,
        },
      },
      description: 'The data for the new substitution.',
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(createResponseSchema)),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Substitution"],
  }),
  requireAuthentication,
  requireAuthorization("substitution:create"),
  async (c) => {
    const body = (await c.req.json()) as {
      date: string;
      lessonIds: string[];
      substituter?: string;
    };

    const { lessonIds, date, substituter } = body;

    if (!(lessonIds && date)) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing required fields: lessonIds and date are required.",
      });
    }

    const dateAsDateType = new Date(date);
    if (Number.isNaN(dateAsDateType.getTime())) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Invalid date format.",
      });
    }

    const lessonCount = await db.$count(lesson, inArray(lesson.id, lessonIds));

    if (lessonCount !== lessonIds.length) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: `attempted to substitute non-existent lesson(s), wanted: ${lessonIds.length}, got: ${lessonCount}`,
      });
    }

    const result = await db.transaction(async (tx) => {
      const [insertedSubstitution] = await tx
        .insert(substitution)
        .values({
          date,
          id: crypto.randomUUID(),
          substituter,
        })
        .returning();

      if (!insertedSubstitution) {
        throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
          cause:
            env.mode === "development"
              ? "No substitution returned from insert query"
              : undefined,
          message: "Failed to create substitution.",
        });
      }

      // Insert the many-to-many relationships
      const mtmValues = lessonIds.map((lessonId) => ({
        lessonId,
        substitutionId: insertedSubstitution.id,
      }));

      await tx.insert(substitutionLessonMTM).values(mtmValues);

      return insertedSubstitution;
    });

    return c.json<SuccessResponse>({
      data: result,
      success: true,
    });
  },
);

const updateSchema = (
  await resolver(
    ensureJsonSafeDates(
      z.object({
        date: z.date().nullable(),
        lessonIds: z.string().array().nullable(),
        substituter: z.string().nullable(),
      }),
    ),
  ).toOpenAPISchema()
).schema;

export const updateSubstitution = timetableFactory.createHandlers(
  describeRoute({
    description: "Update a substitution",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the substitution to update.",
          type: "string",
        },
      },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: updateSchema,
        },
      },
      description: 'The data for updating the substitution.',
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(createResponseSchema)),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Substitution"],
  }),
  requireAuthentication,
  requireAuthorization("substitution:update"),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = (await c.req.json()) as {
        date?: string;
        lessonIds?: string[];
        substituter?: string;
      };

      if (!id) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: "Substitution ID is required",
        });
      }

      const existingSubstitution = await db
        .select()
        .from(substitution)
        .where(eq(substitution.id, id))
        .limit(1);

      if (existingSubstitution.length === 0) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: "Substitution not found",
        });
      }

      if (body.date) {
        const dateAsDate = new Date(body.date);
        if (Number.isNaN(dateAsDate.getTime())) {
          throw new HTTPException(StatusCodes.BAD_REQUEST, {
            message: "Invalid date format",
          });
        }
      }

      if (body.lessonIds) {
        const lessonCount = await db.$count(
          lesson,
          inArray(lesson.id, body.lessonIds),
        );
        if (lessonCount !== body.lessonIds.length) {
          throw new HTTPException(StatusCodes.BAD_REQUEST, {
            message: `Some lessons don't exist, wanted: ${body.lessonIds.length}, found: ${lessonCount}`,
          });
        }
      }

      // Use a transaction to update the substitution and the many-to-many relationships
      const updatedSubstitution = await db.transaction(async (tx) => {
        // Update the substitution (excluding lessonIds)
        const updateData = { ...body };
        updateData.lessonIds = undefined;

        const [updated] = await tx
          .update(substitution)
          .set(updateData)
          .where(eq(substitution.id, id))
          .returning();

        // If lessonIds were provided, update the many-to-many relationships
        if (body.lessonIds) {
          // Delete existing relationships
          await tx
            .delete(substitutionLessonMTM)
            .where(eq(substitutionLessonMTM.substitutionId, id));

          // Insert new relationships
          const mtmValues = body.lessonIds.map((lessonId) => ({
            lessonId,
            substitutionId: id,
          }));

          await tx.insert(substitutionLessonMTM).values(mtmValues);
        }

        return updated;
      });

      return c.json<SuccessResponse>({
        data: updatedSubstitution,
        success: true,
      });
    } catch (error) {
      logger.error("Error while updating substitution", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        cause:
          env.mode === "development" ? (error as Error).message : undefined,
        message: "Failed to update substitution",
      });
    }
  },
);

export const deleteSubstitution = timetableFactory.createHandlers(
  describeRoute({
    description: "Delete a substitution",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the substitution to delete.",
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(createResponseSchema)),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Substitution"],
  }),
  requireAuthentication,
  requireAuthorization("substitution:delete"),
  async (c) => {
    try {
      const id = c.req.param("id");

      if (!id) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: "Substitution ID is required",
        });
      }

      const existingSubstitution = await db
        .select()
        .from(substitution)
        .where(eq(substitution.id, id))
        .limit(1);

      if (existingSubstitution.length === 0) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: "Substitution not found",
        });
      }

      // The many-to-many relationships will be automatically deleted due to the CASCADE constraint
      const [deletedSubstitution] = await db
        .delete(substitution)
        .where(eq(substitution.id, id))
        .returning();

      return c.json<SuccessResponse>({
        data: deletedSubstitution,
        success: true,
      });
    } catch (error) {
      logger.error("Error while deleting substitution", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        cause:
          env.mode === "development" ? (error as Error).message : undefined,
        message: "Failed to delete substitution",
      });
    }
  },
);
