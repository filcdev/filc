import { getLogger } from "@logtape/logtape";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";
import { db } from "~/database";
import { cohort, timetable } from "~/database/schema/timetable";
import type { SuccessResponse } from "~/utils/globals";
import { requireAuthentication } from "~/utils/middleware";
import { timetableFactory } from "../_factory";
import { describeRoute, resolver } from "hono-openapi";
import { ensureJsonSafeDates } from "~/utils/zod";
import z from "zod";
import { createSelectSchema } from "drizzle-zod";

const logger = getLogger(["chronos", "cohort"]);

const GetForTimetableResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(cohort)).array(),
  success: z.boolean(),
});

export const GetCohortsForTimetable = timetableFactory.createHandlers(
  describeRoute({
    description: "Get cohorts for a given timetable from the database.",
    parameters: [
      {
        in: "path",
        name: "timetable_id",
        required: true,
        schema: {
          description: "The unique identifier for the timetable.",
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(
              ensureJsonSafeDates(GetForTimetableResponseSchema),
            ),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Cohort"],
  }),
  requireAuthentication,
  async (c) => {
    try {
      const timetableId = c.req.param("timetable_id");

      if (!timetableId) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: "Missing timetable_id parameter.",
        });
      }

      const cohorts = await db
        .select()
        .from(cohort)
        .leftJoin(timetable, eq(cohort.timetableId, timetable.id))
        .where(eq(timetable.id, timetableId));

      return c.json<SuccessResponse>({
        data: cohorts,
        success: true,
      });
    } catch (error) {
      logger.error("Error fetching cohorts for timetable", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to fetch all cohorts for timetable.",
      });
    }
  },
);
