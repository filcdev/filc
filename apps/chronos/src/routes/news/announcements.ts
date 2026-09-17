import {
  type AnnouncementUpdateInput,
  announcementCreateSchema,
  announcementImageUploadSchema,
  announcementQuerySchema,
  announcementUpdateSchema,
} from '@filcdev/api/domains/news/announcements';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { and, count, eq, type SQL, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import {
  announcement,
  announcementCohortMtm,
  announcementKioskMtm,
} from '#database/schema/news';
import { authRouter } from '#middleware/auth';
import { newsFactory } from '#routes/news/_factory';
import { ApiHttpError, badRequest, notFound, ok } from '#utils/http';
import { activeAnnouncementConditions } from '#utils/news/announcements';
import { validateCohortIds } from '#utils/news/cohort';
import { validateKioskIds } from '#utils/news/kiosks';
import {
  announcementBaseDetailResponseSchema,
  announcementDetailResponseSchema,
  announcementListResponseSchema,
  announcementSelect,
  authorSelect,
  resolveTitle,
  successResponseSchema,
} from '#utils/news/shared';
import {
  cancelPendingNotification,
  dispatchPendingNotification,
} from '#utils/notifications/engine';
import { filcExt } from '#utils/openapi';
import {
  announcementImageKey,
  deleteObject,
  isObjectStorageConfigured,
  putObject,
} from '#utils/storage/s3';

const logger = getLogger(['chronos', 'news']);

/** Content types the kiosk can render, mapped to the extension used in the key. */
const ANNOUNCEMENT_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Uploads above this are refused; the announcement dialog states the limit. */
const MAX_ANNOUNCEMENT_IMAGE_BYTES = 8 * 1024 * 1024;

/** Cohort ids this announcement targets; empty means "everyone". */
const announcementCohortIds = async (id: string): Promise<string[]> =>
  (
    await db
      .select()
      .from(announcementCohortMtm)
      .where(eq(announcementCohortMtm.announcementId, id))
  ).map((m) => m.cohortId);

/** Kiosk ids this announcement takes over; empty means "every kiosk". */
const announcementKioskIds = async (id: string): Promise<string[]> =>
  (
    await db
      .select()
      .from(announcementKioskMtm)
      .where(eq(announcementKioskMtm.announcementId, id))
  ).map((m) => m.kioskId);

/**
 * The kiosk feed only ever carries titled announcements, so a featured item
 * without a title would never reach the screen it was featured on.
 */
function assertFeaturedAnnouncementIsTitled(
  highlighted: boolean,
  title: string | null | undefined
): void {
  if (highlighted && !title) {
    throw badRequest('A highlighted announcement needs a title');
  }
}

/** The columns a PATCH changes; fields absent from the body stay untouched. */
function announcementUpdateValues(
  body: AnnouncementUpdateInput
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  if (body.title !== undefined) {
    values.title = body.title;
  }
  if (body.content !== undefined) {
    values.content = body.content;
  }
  if (body.highlighted !== undefined) {
    values.highlighted = body.highlighted;
  }
  if (body.kioskOnly !== undefined) {
    values.kioskOnly = body.kioskOnly;
  }
  if (body.validFrom !== undefined) {
    values.validFrom = body.validFrom;
  }
  if (body.validUntil !== undefined) {
    values.validUntil = body.validUntil;
  }

  return values;
}

/** Check the targeting a write carries before anything is written. */
async function validateAnnouncementTargeting(
  cohortIds?: string[],
  kioskIds?: string[]
): Promise<void> {
  if (cohortIds && cohortIds.length > 0) {
    await validateCohortIds(cohortIds);
  }
  if (kioskIds && kioskIds.length > 0) {
    await validateKioskIds(kioskIds);
  }
}

/**
 * Replace both targeting row sets of an announcement. An omitted list is left
 * as it is, an empty one clears the targeting (= everyone / every kiosk).
 */
async function setAnnouncementTargeting(
  announcementId: string,
  {
    cohortIds,
    kioskIds,
  }: { cohortIds?: string[] | undefined; kioskIds?: string[] | undefined }
): Promise<void> {
  if (cohortIds !== undefined) {
    await db
      .delete(announcementCohortMtm)
      .where(eq(announcementCohortMtm.announcementId, announcementId));

    if (cohortIds.length > 0) {
      await db
        .insert(announcementCohortMtm)
        .values(cohortIds.map((cohortId) => ({ announcementId, cohortId })));
    }
  }

  if (kioskIds !== undefined) {
    await db
      .delete(announcementKioskMtm)
      .where(eq(announcementKioskMtm.announcementId, announcementId));

    if (kioskIds.length > 0) {
      await db
        .insert(announcementKioskMtm)
        .values(kioskIds.map((kioskId) => ({ announcementId, kioskId })));
    }
  }
}

const { schema: createRequestSchema } = await resolver(
  announcementCreateSchema
).toOpenAPISchema();
const { schema: updateRequestSchema } = await resolver(
  announcementUpdateSchema
).toOpenAPISchema();
const { schema: uploadRequestSchema } = await resolver(
  announcementImageUploadSchema
).toOpenAPISchema();

export const listAnnouncements = newsFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Announcement',
      '@listof Announcement @field(.author, Author)',
      true
    ),
    description:
      'List active announcements within date range, cohort-filtered by default; includeAll=true returns everything',
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
  ...authRouter(),
  zValidator('query', announcementQuerySchema),
  async (c) => {
    const { limit, offset, includeExpired, includeAll, includeKioskOnly } =
      c.req.valid('query');
    const currentUser = c.var.user;
    const userCohortId = currentUser.cohortId;

    // Any signed-in user may request all announcements (e.g. the public panel's
    // "Everyone" option) via includeAll=true.
    const bypassCohortFilter = includeAll;

    const now = new Date();
    const conditions: SQL[] = [];

    if (!includeExpired) {
      conditions.push(...activeAnnouncementConditions(now));
    }

    // Kiosk-only announcements never reach the web app: the panel asks without
    // the flag, the admin table asks with it.
    if (!includeKioskOnly) {
      conditions.push(eq(announcement.kioskOnly, false));
    }

    // Cohort filtering: show items that are global (no rows in M2M)
    // or targeted to the user's cohort. Users without a cohort only see
    // global announcements. includeAll=true bypasses this filter.
    if (!bypassCohortFilter) {
      if (userCohortId) {
        conditions.push(
          sql`(
            NOT EXISTS (SELECT 1 FROM announcement_cohort_mtm WHERE announcement_id = ${announcement.id})
            OR EXISTS (SELECT 1 FROM announcement_cohort_mtm WHERE announcement_id = ${announcement.id} AND cohort_id = ${userCohortId})
          )`
        );
      } else {
        conditions.push(
          sql`NOT EXISTS (SELECT 1 FROM announcement_cohort_mtm WHERE announcement_id = ${announcement.id})`
        );
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db
        .select({ ...announcementSelect, author: authorSelect })
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
    const [cohortMappings, kioskMappings] = await Promise.all([
      itemIds.length > 0
        ? db
            .select()
            .from(announcementCohortMtm)
            .where(sql`${announcementCohortMtm.announcementId} IN ${itemIds}`)
        : [],
      itemIds.length > 0
        ? db
            .select()
            .from(announcementKioskMtm)
            .where(sql`${announcementKioskMtm.announcementId} IN ${itemIds}`)
        : [],
    ]);

    const data = items.map((item) => ({
      ...item,
      cohortIds: cohortMappings
        .filter((m) => m.announcementId === item.id)
        .map((m) => m.cohortId),
      kioskIds: kioskMappings
        .filter((m) => m.announcementId === item.id)
        .map((m) => m.kioskId),
    }));

    return ok(c, data, StatusCodes.OK, { total: totalResult[0]?.count ?? 0 });
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
  ...authRouter(),
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

    const [item] = await db
      .select({ ...announcementSelect, author: authorSelect })
      .from(announcement)
      .leftJoin(user, eq(announcement.authorId, user.id))
      .where(eq(announcement.id, id));

    if (!item) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Announcement not found',
      });
    }

    const cohortIds = await announcementCohortIds(id);
    const kioskIds = await announcementKioskIds(id);

    return ok(c, { ...item, cohortIds, kioskIds });
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
  ...authRouter(permissions.announcementsCreate),
  zValidator('json', announcementCreateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const currentUser = c.var.user;

    assertFeaturedAnnouncementIsTitled(body.highlighted ?? false, body.title);

    await validateAnnouncementTargeting(body.cohortIds, body.kioskIds);

    const [created] = await db
      .insert(announcement)
      .values({
        authorId: currentUser.id,
        content: body.content,
        highlighted: body.highlighted ?? false,
        kioskOnly: body.kioskOnly ?? false,
        title: body.title ?? null,
        validFrom: body.validFrom,
        validUntil: body.validUntil,
      })
      .returning();
    if (!created) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to create announcement',
      });
    }

    await setAnnouncementTargeting(created.id, {
      cohortIds: body.cohortIds,
      kioskIds: body.kioskIds,
    });

    // A kiosk-only announcement is not meant to reach anyone's inbox either.
    if (!created.kioskOnly) {
      dispatchPendingNotification(created.id, 'announcement', {
        cohortIds: body.cohortIds ?? [],
        title: resolveTitle(body.title),
      });
    }

    return ok(
      c,
      {
        ...created,
        cohortIds: body.cohortIds ?? [],
        kioskIds: body.kioskIds ?? [],
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
  ...authRouter(permissions.announcementsCreate),
  zValidator('param', z.object({ id: z.string().uuid() })),
  zValidator('json', announcementUpdateSchema),
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

    // Same invariant as on create, judged against the row this update produces.
    assertFeaturedAnnouncementIsTitled(
      body.highlighted ?? existing.highlighted,
      body.title ?? existing.title
    );

    await validateAnnouncementTargeting(body.cohortIds, body.kioskIds);

    cancelPendingNotification(id, 'announcement');

    // A PATCH may carry only targeting, which writes no columns at all.
    const values = announcementUpdateValues(body);
    let updated = existing;

    if (Object.keys(values).length > 0) {
      const [row] = await db
        .update(announcement)
        .set(values)
        .where(eq(announcement.id, id))
        .returning();
      if (!row) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: 'Announcement not found',
        });
      }
      updated = row;
    }

    await setAnnouncementTargeting(id, {
      cohortIds: body.cohortIds,
      kioskIds: body.kioskIds,
    });

    const cohortIds = body.cohortIds ?? (await announcementCohortIds(id));
    const kioskIds = body.kioskIds ?? (await announcementKioskIds(id));

    if (!updated.kioskOnly) {
      dispatchPendingNotification(id, 'announcement', {
        cohortIds,
        title: resolveTitle(updated.title),
      });
    }

    return ok(c, { ...updated, cohortIds, kioskIds });
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
  ...authRouter(permissions.announcementsCreate),
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

    // The row is gone either way; a failed object delete must not turn a
    // successful delete into a 500.
    if (deleted.imageKey) {
      try {
        await deleteObject(deleted.imageKey);
      } catch (error) {
        logger.warn('Failed to delete the image of a deleted announcement', {
          error,
          key: deleted.imageKey,
        });
      }
    }

    cancelPendingNotification(id, 'announcement');

    return ok(c, undefined);
  }
);

export const uploadAnnouncementImage = newsFactory.createHandlers(
  describeRoute({
    ...filcExt('Announcement', '@unit Announcement', true),
    description: 'Upload the image this announcement shows on the kiosk',
    requestBody: {
      content: {
        'multipart/form-data': {
          schema: uploadRequestSchema,
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
        description: 'Image uploaded',
      },
      400: {
        description:
          'Unsupported image type, image too large, or the announcement has no title',
      },
      404: { description: 'Announcement not found' },
      503: { description: 'Object storage is not configured' },
    },
    tags: ['News / Announcements'],
  }),
  // Authenticate before the form validator so an anonymous request cannot
  // force the whole upload into memory (`z.file()` is unbounded).
  ...authRouter(permissions.announcementsCreate),
  zValidator('param', z.object({ id: z.string().uuid() })),
  zValidator('form', announcementImageUploadSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { file } = c.req.valid('form');

    const [existing] = await db
      .select()
      .from(announcement)
      .where(eq(announcement.id, id));

    if (!existing) {
      throw notFound('Announcement not found');
    }

    if (!isObjectStorageConfigured()) {
      throw new ApiHttpError(StatusCodes.SERVICE_UNAVAILABLE, {
        message: 'Object storage is not configured',
      });
    }

    const extension = ANNOUNCEMENT_IMAGE_EXTENSIONS[file.type];
    if (!extension) {
      throw badRequest('Unsupported image type');
    }

    if (file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
      throw badRequest('The image is too large (max 8 MiB)');
    }

    // Same rule as the highlighted flag: only titled announcements are in the
    // feed, so an untitled one could never show its image.
    if (!existing.title) {
      throw badRequest('An announcement with an image needs a title');
    }

    const key = announcementImageKey(id, extension);
    await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type);

    const [updated] = await db
      .update(announcement)
      .set({
        imageByteSize: file.size,
        imageContentType: file.type,
        imageKey: key,
        imageUpdatedAt: new Date(),
      })
      .where(eq(announcement.id, id))
      .returning();

    if (!updated) {
      throw notFound('Announcement not found');
    }

    // Replacing an image leaves the previous object behind; the row is already
    // correct, so a failed cleanup is logged instead of failing the upload.
    if (existing.imageKey) {
      try {
        await deleteObject(existing.imageKey);
      } catch (error) {
        logger.warn('Failed to delete the replaced announcement image', {
          error,
          key: existing.imageKey,
        });
      }
    }

    return ok(c, {
      ...updated,
      cohortIds: await announcementCohortIds(id),
      kioskIds: await announcementKioskIds(id),
    });
  }
);

export const deleteAnnouncementImage = newsFactory.createHandlers(
  describeRoute({
    ...filcExt('Announcement', '@unit Announcement', true),
    description: 'Delete the image attached to an announcement',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(announcementBaseDetailResponseSchema),
          },
        },
        description: 'Image deleted',
      },
      404: { description: 'Announcement not found, or it has no image' },
    },
    tags: ['News / Announcements'],
  }),
  ...authRouter(permissions.announcementsCreate),
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

    const [existing] = await db
      .select()
      .from(announcement)
      .where(eq(announcement.id, id));

    if (!existing) {
      throw notFound('Announcement not found');
    }
    if (!existing.imageKey) {
      throw notFound('Announcement has no image');
    }

    const key = existing.imageKey;

    const [updated] = await db
      .update(announcement)
      .set({
        imageByteSize: null,
        imageContentType: null,
        imageKey: null,
        imageUpdatedAt: null,
      })
      .where(eq(announcement.id, id))
      .returning();

    if (!updated) {
      throw notFound('Announcement not found');
    }

    // Clearing the row is what removes the image from the kiosk; a failed
    // object delete only leaves an unreferenced object behind.
    try {
      await deleteObject(key);
    } catch (error) {
      logger.warn('Failed to delete an announcement image', { error, key });
    }

    return ok(c, {
      ...updated,
      cohortIds: await announcementCohortIds(id),
      kioskIds: await announcementKioskIds(id),
    });
  }
);
