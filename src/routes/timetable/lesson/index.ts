import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { db } from '~/database';
import { cohort, lesson, lessonCohortMTM } from '~/database/schema/timetable';
import type { SuccessResponse } from '~/utils/globals';
import { timetableFactory } from '../_factory';

export const getLessonsForCohort = timetableFactory.createHandlers(
  async (c) => {
    const cohortId = c.req.param('cohort_id');
    if (!cohortId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing cohort_id',
      });
    }

    const [existingCohort] = await db
      .select()
      .from(cohort)
      .where(eq(cohort.id, cohortId))
      .limit(1);

    if (!existingCohort) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Cohort not found',
      });
    }

    const lessons = await db
      .select()
      .from(lesson)
      .innerJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
      .where(eq(lessonCohortMTM.cohortId, cohortId));

    return c.json<SuccessResponse>({
      success: true,
      data: lessons,
    });
  }
);
