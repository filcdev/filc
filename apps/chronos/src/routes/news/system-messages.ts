import { zValidator } from '@hono/zod-validator';
import { and, count, eq, gte, lte, type SQL, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { systemMessage, systemMessageCohortMtm } from '#database/schema/news';
import { authRouter } from '#middleware/auth';
import { newsFactory } from '#routes/news/_factory';
import { ok } from '#utils/http';
import { validateCohortIds } from '#utils/news/cohort';
import {
  announcementQuerySchema,
  dateRangeBodySchema,
  dateRangeUpdateBodySchema,
} from '#utils/news/schemas';
import {
  authorSelect,
  successResponseSchema,
  systemMessageBaseDetailResponseSchema,
  systemMessageDetailResponseSchema,
  systemMessageListResponseSchema,
} from '#utils/news/shared';
import {
  cancelPendingNotification,
  dispatchPendingNotification,
} from '#utils/notifications/engine';
import { filcExt } from '#utils/openapi';

const { schema: createRequestSchema } =
  await resolver(dateRangeBodySchema).toOpenAPISchema();
const { schema: updateRequestSchema } = await resolver(
  dateRangeUpdateBodySchema
).toOpenAPISchema();

export const listSystemMessages = newsFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'SystemMessage',
      '@listof SystemMessage @field(.author, Author)',
      true
    ),
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
  zValidator('query', announcementQuerySchema),
  async (c) => {
    const { limit, offset, includeExpired } = c.req.valid('query');
    const userCohortId = c.var.user?.cohortId;

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

    return ok(c, data, StatusCodes.OK, { total: totalResult[0]?.count ?? 0 });
  }
);

export const getSystemMessage = newsFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'SystemMessage',
      '@unit SystemMessage @field(.author, Author)',
      true
    ),
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

    return ok(c, { ...item, cohortIds });
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
  ...authRouter('system-messages:manage'),
  zValidator('json', dateRangeBodySchema),
  async (c) => {
    const body = c.req.valid('json');
    const currentUser = c.var.user;

    if (body.cohortIds && body.cohortIds.length > 0) {
      await validateCohortIds(body.cohortIds);
    }

    const [created] = await db
      .insert(systemMessage)
      .values({
        authorId: currentUser.id,
        content: body.content,
        title: body.title,
        validFrom: body.validFrom,
        validUntil: body.validUntil,
      })
      .returning();
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

    dispatchPendingNotification(created.id, 'system_message', {
      cohortIds: body.cohortIds ?? [],
      title: body.title,
    });

    return ok(
      c,
      { ...created, cohortIds: body.cohortIds ?? [] },
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
  ...authRouter('system-messages:manage'),
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

    cancelPendingNotification(id, 'system_message');

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

    const [updated] = await db
      .update(systemMessage)
      .set(updateData)
      .where(eq(systemMessage.id, id))
      .returning();
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

    dispatchPendingNotification(id, 'system_message', {
      cohortIds,
      title: updated.title,
    });

    return ok(c, { ...updated, cohortIds });
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
  ...authRouter('system-messages:manage'),
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

    cancelPendingNotification(id, 'system_message');

    return ok(c, undefined);
  }
);
