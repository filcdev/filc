import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { timetable } from '#database/schema/timetable';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { filcExt } from '#utils/openapi';
import { createSelectSchema } from '#utils/zod';
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
    ...filcExt('Timetable', '@listof Timetable', true),
    description: 'Get all timetables from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getAllResponseSchema),
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

      return c.json<SuccessResponse<typeof timetables>>({
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
    ...filcExt('Timetable', '@unit Timetable', true),
    description: 'Get the latest valid timetable.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getLatestValidReponseSchema),
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
        .where(
          and(
            lte(timetable.validFrom, today),
            or(isNull(timetable.validTo), gte(timetable.validTo, today))
          )
        )
        .orderBy(desc(timetable.validFrom))
        .limit(1);

      if (!latestValidTimetable) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: 'No valid timetable found.',
        });
      }

      return c.json<SuccessResponse<typeof latestValidTimetable>>({
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
    ...filcExt('Timetable', '@listof Timetable', true),
    description: 'Get all the latest valid timetables.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getAllResponseSchema),
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
        .where(
          and(
            lte(timetable.validFrom, today),
            or(isNull(timetable.validTo), gte(timetable.validTo, today))
          )
        );

      return c.json<SuccessResponse<typeof timetables>>({
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

const updateTimetableSchema = z.object({
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
});

const updateTimetableResponseSchema = z.object({
  data: timetableSelectSchema,
  success: z.literal(true),
});

export const updateTimetable = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Timetable', '@unit Timetable', true),
    description: 'Update a timetable validity dates.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(updateTimetableResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  zValidator('param', z.object({ id: z.uuid() })),
  zValidator('json', updateTimetableSchema),
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(timetable)
      .where(eq(timetable.id, id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Timetable not found',
      });
    }

    const [updated] = await db
      .update(timetable)
      .set({
        ...(body.validFrom !== undefined && { validFrom: body.validFrom }),
        ...(body.validTo !== undefined && { validTo: body.validTo }),
      })
      .where(eq(timetable.id, id))
      .returning();

    if (!updated) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to update timetable',
      });
    }

    return c.json<SuccessResponse<typeof updated>>({
      data: updated,
      success: true,
    });
  }
);

const deleteTimetableResponseSchema = z.object({
  success: z.literal(true),
});

export const deleteTimetable = timetableFactory.createHandlers(
  describeRoute({
    description: 'Delete a timetable and all its related data.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(deleteTimetableResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  zValidator('param', z.object({ id: z.uuid() })),
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    const { id } = c.req.valid('param');

    const [existing] = await db
      .select()
      .from(timetable)
      .where(eq(timetable.id, id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Timetable not found',
      });
    }

    await db.delete(timetable).where(eq(timetable.id, id));

    return c.json<SuccessResponse>({ success: true });
  }
);
