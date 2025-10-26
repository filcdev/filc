import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { db } from '~/database';
import { cohort, timetable } from '~/database/schema/timetable';
import type { SuccessResponse } from '~/utils/globals';
import { requireAuthentication } from '~/utils/middleware';
import { timetableFactory } from '../_factory';

const logger = getLogger(['chronos', 'cohort']);

export const getCohortsForTimetable = timetableFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    try {
      const timetableId = c.req.param('timetable_id');

      if (!timetableId) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: 'Missing timetable_id parameter.',
        });
      }

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
      logger.error('Error fetching cohorts for timetable', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch all cohorts for timetable.',
      });
    }
  }
);
