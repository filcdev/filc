import { getLogger } from "@logtape/logtape";
import { timetableFactory } from "../_factory";
import { requireAuthentication } from "~/utils/middleware";
import { db } from "~/database";
import { cohort, timetable } from "~/database/schema/timetable";
import { eq } from "drizzle-orm";
import type { SuccessResponse } from "~/utils/globals";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";

const logger = getLogger(["chronos", "cohort"]);

export const getCohortsForTimetable = timetableFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    try {
      const timetableId = c.req.param("timetable_id")!;

      const cohorts = await db
        .select()
        .from(cohort)
        .leftJoin(timetable, eq(cohort.timetableId, timetable.id))
        .where(eq(timetable.id, timetableId));

      return c.json<SuccessResponse>({
        success: true,
        data: cohorts,
      });
    } catch (error) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to fetch all cohorts for timetable.",
      });
    }
  },
);
