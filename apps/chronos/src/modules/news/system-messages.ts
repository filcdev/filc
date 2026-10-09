import type { DateRangeUpdateBodyInput } from '@filcdev/api/domains/news/system-messages';
import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { and, count, eq, gte, lte, type SQL, sql } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthorization } from '#middleware/auth';
import { systemMessage, systemMessageCohortMtm } from '#modules/news/schema';
import { validateCohortIds } from '#modules/news/utils/cohort';
import { authorSelect } from '#modules/news/utils/shared';
import { base } from '#orpc';
import { badRequest, notFound } from '#utils/http';
import {
  cancelPendingNotification,
  dispatchPendingNotification,
} from '#utils/notifications/engine';

export const listSystemMessages = base.news.systemMessages.list.handler(
  async ({ context, input }) => {
    const { limit, offset, includeExpired } = input;
    const userCohortId = context.user?.cohortId;

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

    return { data, total: totalResult[0]?.count ?? 0 };
  }
);

export const getSystemMessage = base.news.systemMessages.get.handler(
  async ({ input }) => {
    const { id } = input;

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
      throw notFound('System message not found');
    }

    const cohortIds = (
      await db
        .select()
        .from(systemMessageCohortMtm)
        .where(eq(systemMessageCohortMtm.systemMessageId, id))
    ).map((m) => m.cohortId);

    return { ...item, cohortIds };
  }
);

export const createSystemMessage = base.news.systemMessages.create
  .use(requireAuthorization(permissions.systemMessagesManage))
  .handler(async ({ context, input }) => {
    const body = input;
    const authorId = context.session.userId;

    if (body.cohortIds && body.cohortIds.length > 0) {
      await validateCohortIds(body.cohortIds);
    }

    const [created] = await db
      .insert(systemMessage)
      .values({
        authorId,
        content: body.content,
        title: body.title,
        validFrom: body.validFrom,
        validUntil: body.validUntil,
      })
      .returning();
    if (!created) {
      throw new ORPCError('INTERNAL', {
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

    return { ...created, cohortIds: body.cohortIds ?? [] };
  });

export const updateSystemMessage = base.news.systemMessages.update
  .use(requireAuthorization(permissions.systemMessagesManage))
  .handler(async ({ input }) => {
    const { id } = input;
    const body: DateRangeUpdateBodyInput = input;

    const [existing] = await db
      .select()
      .from(systemMessage)
      .where(eq(systemMessage.id, id));

    if (!existing) {
      throw notFound('System message not found');
    }

    const validFrom = body.validFrom ?? existing.validFrom;
    const validUntil = body.validUntil ?? existing.validUntil;
    if (validUntil <= validFrom) {
      throw badRequest('validUntil must be after validFrom');
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
      throw notFound('System message not found');
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

    return { ...updated, cohortIds };
  });

export const deleteSystemMessage = base.news.systemMessages.delete
  .use(requireAuthorization(permissions.systemMessagesManage))
  .handler(async ({ input }) => {
    const { id } = input;

    const [deleted] = await db
      .delete(systemMessage)
      .where(eq(systemMessage.id, id))
      .returning();

    if (!deleted) {
      throw notFound('System message not found');
    }

    cancelPendingNotification(id, 'system_message');

    return { id };
  });
