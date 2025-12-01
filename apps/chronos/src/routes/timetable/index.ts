import { getLogger } from '@logtape/logtape';
import { desc, gte } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '@/database';
import { timetable } from '@/database/schema/timetable';
import type { SuccessResponse } from '@/utils/globals';
import { requireAuthentication } from '@/utils/middleware';
import { ensureJsonSafeDates } from '@/utils/zod';
import { timetableFactory } from './_factory';

const logger = getLogger(['chronos', 'timetable']);

const timetableSelectSchema = createSelectSchema(timetable);

const getAllResponseSchema = z.object({
  data: z.array(timetableSelectSchema),
  success: z.literal(true),
});

const getLatestValidReponseSchema = z.object({
  data: timetableSelectSchema,
  success: z.literal(true),
});

export const getAllTimetables = timetableFactory.createHandlers(
  describeRoute({
    description: 'Get all timetables from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(getAllResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  requireAuthentication,
  async (c) => {
    try {
      const timetables = await db.select().from(timetable);

      return c.json<SuccessResponse>({
        data: timetables,
        success: true,
      });
    } catch (error) {
      logger.error('Error while getting all timetables: ', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch all timetables',
      });
    }
  }
);

const dateToYYYYMMDD = (date: Date): string =>
  date.toLocaleDateString('en-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export const getLatestValidTimetable = timetableFactory.createHandlers(
  describeRoute({
    description: 'Get the latest valid timetable.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(getLatestValidReponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  requireAuthentication,
  async (c) => {
    const today = dateToYYYYMMDD(new Date());
    try {
      const [latestValidTimetable] = await db
        .select()
        .from(timetable)
        .where(gte(timetable.validFrom, today))
        .orderBy(desc(timetable.validFrom))
        .limit(1);

      if (!latestValidTimetable) {
        return c.json<SuccessResponse>({
          data: 'No valid timetable found.',
          success: true,
        });
      }

      return c.json<SuccessResponse>({
        data: latestValidTimetable,
        success: true,
      });
    } catch (error) {
      logger.error('Failed to get latest valid timetable: ', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to get latest valid template.',
      });
    }
  }
);

export const getAllValidTimetables = timetableFactory.createHandlers(
  describeRoute({
    description: 'Get all the latest valid timetables.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(getAllResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  requireAuthentication,
  async (c) => {
    try {
      const today = dateToYYYYMMDD(new Date());

      const timetables = await db
        .select()
        .from(timetable)
        .where(gte(timetable.validFrom, today.toString()));

      return c.json<SuccessResponse>({
        data: timetables,
        success: true,
      });
    } catch (error) {
      logger.error('Error while getting all timetables: ', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch all timetables',
      });
    }
  }
);
