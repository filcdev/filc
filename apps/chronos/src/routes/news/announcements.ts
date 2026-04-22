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
import { announcement, announcementCohortMtm } from '#database/schema/news';
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

const announcementSelectSchema = createSelectSchema(announcement);
const authorSchema = z.object({
  id: z.string(),
  image: z.string().nullable(),
  name: z.string(),
});

const announcementItemSchema = announcementSelectSchema.extend({
  author: authorSchema.nullable().optional(),
  cohortIds: z.array(z.string()),
});

const announcementListResponseSchema = z.object({
  data: z.array(announcementItemSchema),
  success: z.literal(true),
  total: z.number(),
});

const announcementDetailResponseSchema = z.object({
  data: announcementItemSchema,
  success: z.literal(true),
});

const announcementBaseDetailResponseSchema = z.object({
  data: announcementSelectSchema.extend({ cohortIds: z.array(z.string()) }),
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

export const listAnnouncements = newsFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Announcement',
      '@listof Announcement @field(.author, Author)',
      true
    ),
    description:
      'List active announcements within date range, filtered by user cohort',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(announcementListResponseSchema),
          },
        },
        description: 'Paginated list of announcements',
      },
    },
    tags: ['News / Announcements'],
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
      conditions.push(lte(announcement.validFrom, now));
      conditions.push(gte(announcement.validUntil, now));
    }

    // Cohort filtering: show items that are global (no rows in M2M)
    // or targeted to the user's cohort
    if (userCohortId) {
      conditions.push(
        sql`(
          NOT EXISTS (SELECT 1 FROM announcement_cohort_mtm WHERE announcement_id = ${announcement.id})
          OR EXISTS (SELECT 1 FROM announcement_cohort_mtm WHERE announcement_id = ${announcement.id} AND cohort_id = ${userCohortId})
        )`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db
        .select({
          author: authorSelect,
          authorId: announcement.authorId,
          content: announcement.content,
          createdAt: announcement.createdAt,
          id: announcement.id,
          title: announcement.title,
          updatedAt: announcement.updatedAt,
          validFrom: announcement.validFrom,
          validUntil: announcement.validUntil,
        })
        .from(announcement)
        .leftJoin(user, eq(announcement.authorId, user.id))
        .where(where)
        .orderBy(sql`${announcement.validFrom} DESC`)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(announcement).where(where),
    ]);

    // Fetch cohort IDs for each announcement
    const itemIds = items.map((i) => i.id);
    const cohortMappings =
      itemIds.length > 0
        ? await db
            .select()
            .from(announcementCohortMtm)
            .where(sql`${announcementCohortMtm.announcementId} IN ${itemIds}`)
        : [];

    const data = items.map((item) => ({
      ...item,
      cohortIds: cohortMappings
        .filter((m) => m.announcementId === item.id)
        .map((m) => m.cohortId),
    }));

    return c.json<SuccessResponse<typeof data> & { total: number }>({
      data,
      success: true,
      total: totalResult[0]?.count ?? 0,
    });
  }
);

export const getAnnouncement = newsFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Announcement',
      '@unit Announcement @field(.author, Author)',
      true
    ),
    description: 'Get a single announcement by ID',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(announcementDetailResponseSchema),
          },
        },
        description: 'Announcement details',
      },
      404: { description: 'Announcement not found' },
    },
    tags: ['News / Announcements'],
  }),
  requireAuthentication,
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

    const [item] = await db
      .select({
        author: authorSelect,
        authorId: announcement.authorId,
        content: announcement.content,
        createdAt: announcement.createdAt,
        id: announcement.id,
        title: announcement.title,
        updatedAt: announcement.updatedAt,
        validFrom: announcement.validFrom,
        validUntil: announcement.validUntil,
      })
      .from(announcement)
      .leftJoin(user, eq(announcement.authorId, user.id))
      .where(eq(announcement.id, id));

    if (!item) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Announcement not found',
      });
    }

    const cohortIds = (
      await db
        .select()
        .from(announcementCohortMtm)
        .where(eq(announcementCohortMtm.announcementId, id))
    ).map((m) => m.cohortId);

    return c.json<SuccessResponse<typeof item & { cohortIds: string[] }>>({
      data: { ...item, cohortIds },
      success: true,
    });
  }
);

export const createAnnouncement = newsFactory.createHandlers(
  describeRoute({
    ...filcExt('Announcement', '@unit Announcement', true),
    description: 'Create a new announcement',
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
            schema: resolver(announcementBaseDetailResponseSchema),
          },
        },
        description: 'Announcement created',
      },
      400: { description: 'Invalid input or cohort IDs' },
    },
    tags: ['News / Announcements'],
  }),
  requireAuthentication,
  requireAuthorization('news:announcements'),
  zValidator('json', dateRangeBodySchema),
  async (c) => {
    const body = c.req.valid('json');
    const currentUser = c.var.user;

    // Validate cohort IDs if provided
    if (body.cohortIds && body.cohortIds.length > 0) {
      await validateCohortIds(body.cohortIds);
    }

    const rows = await db
      .insert(announcement)
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
        message: 'Failed to create announcement',
      });
    }
    if (body.cohortIds && body.cohortIds.length > 0) {
      await db.insert(announcementCohortMtm).values(
        body.cohortIds.map((cohortId) => ({
          announcementId: created.id,
          cohortId,
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

export const updateAnnouncement = newsFactory.createHandlers(
  describeRoute({
    ...filcExt('Announcement', '@unit Announcement', true),
    description: 'Update an existing announcement',
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
            schema: resolver(announcementBaseDetailResponseSchema),
          },
        },
        description: 'Announcement updated',
      },
      400: { description: 'Invalid input or date range' },
      404: { description: 'Announcement not found' },
    },
    tags: ['News / Announcements'],
  }),
  requireAuthentication,
  requireAuthorization('news:announcements'),
  zValidator('param', z.object({ id: z.string().uuid() })),
  zValidator('json', dateRangeUpdateBodySchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(announcement)
      .where(eq(announcement.id, id));

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Announcement not found',
      });
    }

    // Validate date range with existing values
    const validFrom = body.validFrom ?? existing.validFrom;
    const validUntil = body.validUntil ?? existing.validUntil;
    if (validUntil < validFrom) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'validUntil must be on or after validFrom',
      });
    }

    // Validate cohort IDs if provided
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
      .update(announcement)
      .set(updateData)
      .where(eq(announcement.id, id))
      .returning();
    const updated = updatedRows[0];
    if (!updated) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Announcement not found',
      });
    }
    if (body.cohortIds !== undefined) {
      await db
        .delete(announcementCohortMtm)
        .where(eq(announcementCohortMtm.announcementId, id));

      if (body.cohortIds.length > 0) {
        await db.insert(announcementCohortMtm).values(
          body.cohortIds.map((cohortId) => ({
            announcementId: id,
            cohortId,
          }))
        );
      }
    }

    const cohortIds =
      body.cohortIds ??
      (
        await db
          .select()
          .from(announcementCohortMtm)
          .where(eq(announcementCohortMtm.announcementId, id))
      ).map((m) => m.cohortId);

    return c.json({
      data: { ...updated, cohortIds },
      success: true as const,
    });
  }
);

export const deleteAnnouncement = newsFactory.createHandlers(
  describeRoute({
    ...filcExt('Announcement', '@nodata', true),
    description: 'Delete an announcement',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(successResponseSchema),
          },
        },
        description: 'Announcement deleted',
      },
      404: { description: 'Announcement not found' },
    },
    tags: ['News / Announcements'],
  }),
  requireAuthentication,
  requireAuthorization('news:announcements'),
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(announcement)
      .where(eq(announcement.id, id))
      .returning();

    if (!deleted) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Announcement not found',
      });
    }

    return c.json<SuccessResponse>({
      success: true,
    });
  }
);
