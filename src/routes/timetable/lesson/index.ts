import { requireAuthentication } from "~/utils/middleware";
import { timetableFactory } from "../_factory";
import { db } from "~/database";
import { lesson, lessonCohortMTM } from "~/database/schema/timetable";
import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";

export const getLessonsForCohort = timetableFactory.createHandlers(
  async (c) => {
    const cohortId = c.req.param("cohort_id");
    if (!cohortId) {
      return c.json(
        {
          status: "error",
          message: "Param cohort_id not found",
        },
        StatusCodes.BAD_REQUEST,
      );
    }

    const lessons = await db
      .select()
      .from(lesson)
      .innerJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
      .where(eq(lessonCohortMTM.cohortId, cohortId));

    return c.json(
      {
        status: "success",
        lessons,
      },
      StatusCodes.OK,
    );
  },
);
