import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { timetable } from '#database/schema/timetable';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { createSelectSchema } from '#utils/zod';
import { timetableFactory } from './_factory';

const logger = getLogger(['chronos', 'timetable']);

const timetableSelectSchema = createSelectSchema(timetable);

const updateSchema = z.object({
  name: z.string().optional(),
  validFrom: z.string().optional(),
});

const updateResponseSchema = z.object({
  data: timetableSelectSchema,
  success: z.literal(true),
});

const deleteResponseSchema = z.object({
  success: z.literal(true),
});

export const updateTimetable = timetableFactory.createHandlers(
  describeRoute({
    description: 'Update a timetable name and/or validFrom date.',
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {
          description: 'The unique identifier for the timetable.',
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(updateResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  zValidator('param', z.object({ id: z.string() })),
  zValidator('json', updateSchema),
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    try {
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

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) {
        updateData.name = body.name;
      }
      if (body.validFrom !== undefined) {
        updateData.validFrom = body.validFrom;
      }

      if (Object.keys(updateData).length === 0) {
        return c.json<SuccessResponse<typeof existing>>({
          data: existing,
          success: true,
        });
      }

      const [updated] = await db
        .update(timetable)
        .set(updateData)
        .where(eq(timetable.id, id))
        .returning();

      return c.json<SuccessResponse<typeof updated>>({
        data: updated,
        success: true,
      });
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      logger.error('Error updating timetable: ', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to update timetable',
      });
    }
  }
);

export const deleteTimetable = timetableFactory.createHandlers(
  describeRoute({
    description: 'Delete a timetable and all associated data.',
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {
          description: 'The unique identifier for the timetable.',
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(deleteResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  zValidator('param', z.object({ id: z.string() })),
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    const { id } = c.req.valid('param');

    try {
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

      return c.json<SuccessResponse>({
        success: true,
      });
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      logger.error('Error deleting timetable: ', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to delete timetable',
      });
    }
  }
);
