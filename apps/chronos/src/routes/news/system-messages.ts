import { zValidator } from '@hono/zod-validator';
import type { SQL } from 'drizzle-orm';
import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { systemMessage, systemMessageCohortMtm } from '#database/schema/news';
import { cohort } from '#database/schema/timetable';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { newsFactory } from '#routes/news/_factory';
import {
  announcementQuerySchema,
  dateRangeBodySchema,
  dateRangeUpdateBodySchema,
} from '#utils/news/schemas';
import { filcExt } from '#utils/openapi';
import { createSelectSchema } from '#utils/zod';

const validateCohortIds = async (cohortIds: string[]) => {
  const existingCohorts = await db
    .select({ id: cohort.id })
    .from(cohort)
    .where(sql`${cohort.id} IN ${cohortIds}`);
  const existingIds = new Set(existingCohorts.map((co) => co.id));
  const invalid = cohortIds.filter((cid) => !existingIds.has(cid));
  if (invalid.length > 0) {
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      message: `Invalid cohort IDs: ${invalid.join(', ')}`,
    });
  }
};

const authorSelect = {
  id: user.id,
  image: user.image,
  name: user.name,
};

const systemMessageSelectSchema = createSelectSchema(systemMessage);
const authorSchema = z.object({
  id: z.string(),
  image: z.string().nullable(),
  name: z.string(),
});

const systemMessageItemSchema = systemMessageSelectSchema.extend({
  author: authorSchema.nullable().optional(),
  cohortIds: z.array(z.string()),
});

const systemMessageListResponseSchema = z.object({
  data: z.array(systemMessageItemSchema),
  success: z.literal(true),
  total: z.number(),
});

const systemMessageDetailResponseSchema = z.object({
  data: systemMessageItemSchema,
  success: z.literal(true),
});

const systemMessageBaseDetailResponseSchema = z.object({
  data: systemMessageSelectSchema.extend({ cohortIds: z.array(z.string()) }),
  success: z.literal(true),
});

const successResponseSchema = z.object({
  success: z.literal(true),
});

const { schema: createRequestSchema } =
  await resolver(dateRangeBodySchema).toOpenAPISchema();
const { schema: updateRequestSchema } = await resolver(
  dateRangeUpdateBodySchema
).toOpenAPISchema();

export const listSystemMessages = newsFactory.createHandlers(
  describeRoute({
    ...filcExt('SystemMessage', '@listof SystemMessage @field(.author, Author?)', true),
    description:
      'List active system messages within date range, filtered by user cohort',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(systemMessageListResponseSchema),
          },
        },
        description: 'Paginated list of system messages',
      },
    },
    tags: ['News / System Messages'],
  }),
  requireAuthentication,
  zValidator('query', announcementQuerySchema),
  async (c) => {
    const { limit, offset, includeExpired } = c.req.valid('query');
    const currentUser = c.var.user;
    const userCohortId = currentUser.cohortId;

    const now = new Date();
    const conditions: SQL[] = [];

    if (!includeExpired) {
      conditions.push(lte(systemMessage.validFrom, now));
      conditions.push(gte(systemMessage.validUntil, now));
    }

    if (userCohortId) {
      conditions.push(
        sql`(
          NOT EXISTS (SELECT 1 FROM system_message_cohort_mtm WHERE system_message_id = ${systemMessage.id})
          OR EXISTS (SELECT 1 FROM system_message_cohort_mtm WHERE system_message_id = ${systemMessage.id} AND cohort_id = ${userCohortId})
        )`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db
        .select({
          author: authorSelect,
          authorId: systemMessage.authorId,
          content: systemMessage.content,
          createdAt: systemMessage.createdAt,
          id: systemMessage.id,
          title: systemMessage.title,
          updatedAt: systemMessage.updatedAt,
          validFrom: systemMessage.validFrom,
          validUntil: systemMessage.validUntil,
        })
        .from(systemMessage)
        .leftJoin(user, eq(systemMessage.authorId, user.id))
        .where(where)
        .orderBy(sql`${systemMessage.validFrom} DESC`)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(systemMessage).where(where),
    ]);

    const itemIds = items.map((i) => i.id);
    const cohortMappings =
      itemIds.length > 0
        ? await db
            .select()
            .from(systemMessageCohortMtm)
            .where(sql`${systemMessageCohortMtm.systemMessageId} IN ${itemIds}`)
        : [];

    const data = items.map((item) => ({
      ...item,
      cohortIds: cohortMappings
        .filter((m) => m.systemMessageId === item.id)
        .map((m) => m.cohortId),
    }));

    return c.json<SuccessResponse<typeof data> & { total: number }>({
      data,
      success: true,
      total: totalResult[0]?.count ?? 0,
    });
  }
);

export const getSystemMessage = newsFactory.createHandlers(
  describeRoute({
    ...filcExt('SystemMessage', '@unit SystemMessage @field(.author, Author?)', true),
    description: 'Get a single system message by ID',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(systemMessageDetailResponseSchema),
          },
        },
        description: 'System message details',
      },
      404: { description: 'System message not found' },
    },
    tags: ['News / System Messages'],
  }),
  requireAuthentication,
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

    const [item] = await db
      .select({
        author: authorSelect,
        authorId: systemMessage.authorId,
        content: systemMessage.content,
        createdAt: systemMessage.createdAt,
        id: systemMessage.id,
        title: systemMessage.title,
        updatedAt: systemMessage.updatedAt,
        validFrom: systemMessage.validFrom,
        validUntil: systemMessage.validUntil,
      })
      .from(systemMessage)
      .leftJoin(user, eq(systemMessage.authorId, user.id))
      .where(eq(systemMessage.id, id));

    if (!item) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'System message not found',
      });
    }

    const cohortIds = (
      await db
        .select()
        .from(systemMessageCohortMtm)
        .where(eq(systemMessageCohortMtm.systemMessageId, id))
    ).map((m) => m.cohortId);

    return c.json<SuccessResponse<typeof item & { cohortIds: string[] }>>({
      data: { ...item, cohortIds },
      success: true,
    });
  }
);

export const createSystemMessage = newsFactory.createHandlers(
  describeRoute({
    ...filcExt('SystemMessage', '@unit SystemMessage', true),
    description: 'Create a new system message',
    requestBody: {
      content: {
        'application/json': {
          schema: createRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(systemMessageBaseDetailResponseSchema),
          },
        },
        description: 'System message created',
      },
      400: { description: 'Invalid input or cohort IDs' },
    },
    tags: ['News / System Messages'],
  }),
  requireAuthentication,
  requireAuthorization('news:system'),
  zValidator('json', dateRangeBodySchema),
  async (c) => {
    const body = c.req.valid('json');
    const currentUser = c.var.user;

    if (body.cohortIds && body.cohortIds.length > 0) {
      await validateCohortIds(body.cohortIds);
    }

    const rows = await db
      .insert(systemMessage)
      .values({
        authorId: currentUser.id,
        content: body.content,
        title: body.title,
        validFrom: body.validFrom,
        validUntil: body.validUntil,
      })
      .returning();
    const created = rows[0];
    if (!created) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to create system message',
      });
    }

    if (body.cohortIds && body.cohortIds.length > 0) {
      await db.insert(systemMessageCohortMtm).values(
        body.cohortIds.map((cohortId) => ({
          cohortId,
          systemMessageId: created.id,
        }))
      );
    }

    return c.json(
      {
        data: { ...created, cohortIds: body.cohortIds ?? [] },
        success: true as const,
      },
      StatusCodes.CREATED
    );
  }
);

export const updateSystemMessage = newsFactory.createHandlers(
  describeRoute({
    ...filcExt('SystemMessage', '@unit SystemMessage', true),
    description: 'Update an existing system message',
    requestBody: {
      content: {
        'application/json': {
          schema: updateRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(systemMessageBaseDetailResponseSchema),
          },
        },
        description: 'System message updated',
      },
      400: { description: 'Invalid input or date range' },
      404: { description: 'System message not found' },
    },
    tags: ['News / System Messages'],
  }),
  requireAuthentication,
  requireAuthorization('news:system'),
  zValidator('param', z.object({ id: z.string().uuid() })),
  zValidator('json', dateRangeUpdateBodySchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(systemMessage)
      .where(eq(systemMessage.id, id));

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'System message not found',
      });
    }

    const validFrom = body.validFrom ?? existing.validFrom;
    const validUntil = body.validUntil ?? existing.validUntil;
    if (validUntil <= validFrom) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'validUntil must be after validFrom',
      });
    }

    if (body.cohortIds && body.cohortIds.length > 0) {
      await validateCohortIds(body.cohortIds);
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.content !== undefined) {
      updateData.content = body.content;
    }
    if (body.validFrom !== undefined) {
      updateData.validFrom = body.validFrom;
    }
    if (body.validUntil !== undefined) {
      updateData.validUntil = body.validUntil;
    }

    const updatedRows = await db
      .update(systemMessage)
      .set(updateData)
      .where(eq(systemMessage.id, id))
      .returning();
    const updated = updatedRows[0];
    if (!updated) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'System message not found',
      });
    }

    if (body.cohortIds !== undefined) {
      await db
        .delete(systemMessageCohortMtm)
        .where(eq(systemMessageCohortMtm.systemMessageId, id));

      if (body.cohortIds.length > 0) {
        await db.insert(systemMessageCohortMtm).values(
          body.cohortIds.map((cohortId) => ({
            cohortId,
            systemMessageId: id,
          }))
        );
      }
    }

    const cohortIds =
      body.cohortIds ??
      (
        await db
          .select()
          .from(systemMessageCohortMtm)
          .where(eq(systemMessageCohortMtm.systemMessageId, id))
      ).map((m) => m.cohortId);

    return c.json({
      data: { ...updated, cohortIds },
      success: true as const,
    });
  }
);

export const deleteSystemMessage = newsFactory.createHandlers(
  describeRoute({
    ...filcExt('SystemMessage', '@nodata', true),
    description: 'Delete a system message',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(successResponseSchema),
          },
        },
        description: 'System message deleted',
      },
      404: { description: 'System message not found' },
    },
    tags: ['News / System Messages'],
  }),
  requireAuthentication,
  requireAuthorization('news:system'),
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(systemMessage)
      .where(eq(systemMessage.id, id))
      .returning();

    if (!deleted) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'System message not found',
      });
    }

    return c.json<SuccessResponse>({
      success: true,
    });
  }
);
