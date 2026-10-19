import type { AnnouncementUpdateInput } from '@filcdev/api/domains/news/announcements';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { ORPCError } from '@orpc/server';
import { and, count, eq, type SQL, sql } from 'drizzle-orm';
import type { ChronosContext } from '#_types/globals';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import {
  diffActivity,
  recordActivity,
} from '#modules/activity-log/utils/record';
import {
  announcement,
  announcementCohortMtm,
  announcementKioskMtm,
} from '#modules/news/schema';
import { activeAnnouncementConditions } from '#modules/news/utils/announcements';
import {
  cohortVisibilityCondition,
  validateCohortIds,
} from '#modules/news/utils/cohort';
import { validateKioskIds } from '#modules/news/utils/kiosks';
import {
  announcementSelect,
  authorSelect,
  resolveTitle,
} from '#modules/news/utils/shared';
import { base } from '#orpc';
import { badRequest, notFound, serviceUnavailable } from '#utils/http';
import {
  cancelPendingNotification,
  dispatchPendingNotification,
} from '#utils/notifications/engine';
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
/**
 * Best-effort audit of an announcement update: only the fields the PATCH
 * touched, judged against the row it started from, plus targeting lists.
 */
async function auditAnnouncementUpdate(
  context: ChronosContext,
  id: string,
  body: AnnouncementUpdateInput,
  existing: typeof announcement.$inferSelect
) {
  const diff = diffActivity(existing, body, [
    'content',
    'highlighted',
    'kioskOnly',
    'title',
    'validFrom',
    'validUntil',
  ]);
  const after = {
    ...(body.cohortIds === undefined ? {} : { cohortIds: body.cohortIds }),
    ...(body.kioskIds === undefined ? {} : { kioskIds: body.kioskIds }),
    ...(diff?.after ?? {}),
  };
  const before = {
    ...(body.cohortIds === undefined
      ? {}
      : { cohortIds: await announcementCohortIds(id) }),
    ...(body.kioskIds === undefined
      ? {}
      : { kioskIds: await announcementKioskIds(id) }),
    ...(diff?.before ?? {}),
  };
  if (Object.keys(after).length > 0) {
    await recordActivity(context, {
      action: 'update',
      entityId: id,
      entityType: 'announcement',
      metadata: { after, before },
    });
  }
}

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
  // Clear-then-reinsert must not be observable half-done: a failure between the
  // two leaves the announcement with no targeting at all (i.e. visible to
  // everyone), which is the opposite of what the caller asked for.
  await db.transaction(async (tx) => {
    if (cohortIds !== undefined) {
      await tx
        .delete(announcementCohortMtm)
        .where(eq(announcementCohortMtm.announcementId, announcementId));

      if (cohortIds.length > 0) {
        await tx
          .insert(announcementCohortMtm)
          .values(cohortIds.map((cohortId) => ({ announcementId, cohortId })));
      }
    }

    if (kioskIds !== undefined) {
      await tx
        .delete(announcementKioskMtm)
        .where(eq(announcementKioskMtm.announcementId, announcementId));

      if (kioskIds.length > 0) {
        await tx
          .insert(announcementKioskMtm)
          .values(kioskIds.map((kioskId) => ({ announcementId, kioskId })));
      }
    }
  });
}

export const listAnnouncements = base.news.announcements.list
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const { limit, offset, includeExpired, includeAll, includeKioskOnly } =
      input;
    const userCohortId = context.user?.cohortId;

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

    // Cohort filtering: show items that are global or targeted to the viewer's
    // cohort. includeAll=true bypasses this filter.
    if (!bypassCohortFilter) {
      conditions.push(
        cohortVisibilityCondition(
          announcementCohortMtm,
          announcementCohortMtm.announcementId,
          announcement.id,
          announcementCohortMtm.cohortId,
          userCohortId
        )
      );
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

    return { items: data, total: totalResult[0]?.count ?? 0 };
  });

export const getAnnouncement = base.news.announcements.get
  .use(requireAuthentication)
  .handler(async ({ input }) => {
    const { id } = input;

    const [item] = await db
      .select({ ...announcementSelect, author: authorSelect })
      .from(announcement)
      .leftJoin(user, eq(announcement.authorId, user.id))
      .where(eq(announcement.id, id));

    if (!item) {
      throw notFound('Announcement not found');
    }

    const cohortIds = await announcementCohortIds(id);
    const kioskIds = await announcementKioskIds(id);

    return { ...item, cohortIds, kioskIds };
  });

export const createAnnouncement = base.news.announcements.create
  .use(requireAuthorization(permissions.announcementsCreate))
  .handler(async ({ context, input }) => {
    const body = input;
    const authorId = context.session.userId;

    assertFeaturedAnnouncementIsTitled(body.highlighted ?? false, body.title);

    await validateAnnouncementTargeting(body.cohortIds, body.kioskIds);

    const [created] = await db
      .insert(announcement)
      .values({
        authorId,
        content: body.content,
        highlighted: body.highlighted ?? false,
        kioskOnly: body.kioskOnly ?? false,
        title: body.title ?? null,
        validFrom: body.validFrom,
        validUntil: body.validUntil,
      })
      .returning();
    if (!created) {
      throw new ORPCError('INTERNAL', {
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

    await recordActivity(context, {
      action: 'create',
      entityId: created.id,
      entityType: 'announcement',
    });

    return {
      ...created,
      cohortIds: body.cohortIds ?? [],
      kioskIds: body.kioskIds ?? [],
    };
  });

export const updateAnnouncement = base.news.announcements.update
  .use(requireAuthorization(permissions.announcementsCreate))
  .handler(async ({ context, input }) => {
    const { id } = input;
    const body: AnnouncementUpdateInput = input;

    const [existing] = await db
      .select()
      .from(announcement)
      .where(eq(announcement.id, id));

    if (!existing) {
      throw notFound('Announcement not found');
    }

    // Validate date range with existing values
    const validFrom = body.validFrom ?? existing.validFrom;
    const validUntil = body.validUntil ?? existing.validUntil;
    if (validUntil < validFrom) {
      throw badRequest('validUntil must be on or after validFrom');
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
        throw notFound('Announcement not found');
      }
      updated = row;
    }

    await setAnnouncementTargeting(id, {
      cohortIds: body.cohortIds,
      kioskIds: body.kioskIds,
    });

    await auditAnnouncementUpdate(context, id, body, existing);

    const cohortIds = body.cohortIds ?? (await announcementCohortIds(id));
    const kioskIds = body.kioskIds ?? (await announcementKioskIds(id));

    if (!updated.kioskOnly) {
      dispatchPendingNotification(id, 'announcement', {
        cohortIds,
        title: resolveTitle(updated.title),
      });
    }

    return { ...updated, cohortIds, kioskIds };
  });

export const deleteAnnouncement = base.news.announcements.delete
  .use(requireAuthorization(permissions.announcementsCreate))
  .handler(async ({ context, input }) => {
    const { id } = input;

    const [deleted] = await db
      .delete(announcement)
      .where(eq(announcement.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Announcement not found');
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

    await recordActivity(context, {
      action: 'delete',
      entityId: id,
      entityType: 'announcement',
    });

    return { id };
  });

export const uploadAnnouncementImage = base.news.announcements.uploadImage
  .use(requireAuthorization(permissions.announcementsCreate))
  .handler(async ({ input }) => {
    const { file, id } = input;

    const [existing] = await db
      .select()
      .from(announcement)
      .where(eq(announcement.id, id));

    if (!existing) {
      throw notFound('Announcement not found');
    }

    if (!isObjectStorageConfigured()) {
      throw serviceUnavailable('Object storage is not configured');
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

    return {
      ...updated,
      cohortIds: await announcementCohortIds(id),
      kioskIds: await announcementKioskIds(id),
    };
  });

export const deleteAnnouncementImage = base.news.announcements.deleteImage
  .use(requireAuthorization(permissions.announcementsCreate))
  .handler(async ({ input }) => {
    const { id } = input;

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

    return {
      ...updated,
      cohortIds: await announcementCohortIds(id),
      kioskIds: await announcementKioskIds(id),
    };
  });
