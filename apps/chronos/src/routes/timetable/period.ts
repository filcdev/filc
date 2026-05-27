import { zValidator } from '@hono/zod-validator';
import { asc, eq, inArray } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { lesson, period } from '#database/schema/timetable';
import { filcExt } from '#utils/openapi';
import { timetableFactory } from './_factory';

const getPeriodsResponseSchema = z.object({
  data: z
    .object({
      endTime: z.string(),
      id: z.string(),
      period: z.number(),
      startTime: z.string(),
    })
    .array(),
  success: z.boolean(),
});

const getPeriodsQuerySchema = z.object({
  timetableId: z.string().uuid().optional(),
});

export const getPeriodsForTimetable = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Period', '@listof Period'),
    description:
      'Get all period definitions used in a given timetable, sorted by period number.',
    parameters: [
      {
        in: 'query',
        name: 'timetableId',
        required: false,
        schema: {
          description:
            'Optional timetable id to scope periods to those used in that timetable.',
          format: 'uuid',
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getPeriodsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Period'],
  }),
  zValidator('query', getPeriodsQuerySchema),
  async (c) => {
    const { timetableId } = c.req.valid('query');

    let periods: (typeof period.$inferSelect)[];

    if (timetableId) {
      // Get all distinct period IDs used in lessons for this timetable
      const usedPeriodIds = await db
        .selectDistinct({ periodId: lesson.periodId })
        .from(lesson)
        .where(eq(lesson.timetableId, timetableId));

      const ids = usedPeriodIds.map((r) => r.periodId);

      if (ids.length === 0) {
        return c.json<SuccessResponse<[]>>({ data: [], success: true });
      }

      periods = await db
        .select()
        .from(period)
        .where(inArray(period.id, ids))
        .orderBy(asc(period.period));
    } else {
      periods = await db.select().from(period).orderBy(asc(period.period));
    }

    const data = periods.map((p) => ({
      endTime: String(p.endTime),
      id: p.id,
      period: p.period,
      startTime: String(p.startTime),
    }));

    return c.json<SuccessResponse<typeof data>>({ data, success: true });
  }
);
