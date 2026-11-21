import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { recordActivity } from '#modules/activity-log/utils/record';
import { event } from '#modules/events/schema';
import {
  canManageEvents,
  presentEvent,
  resolveEventViewer,
} from '#modules/events/utils/events';
import { base } from '#orpc';
import { badRequest, notFound, serviceUnavailable } from '#utils/http';
import {
  deleteObject,
  eventImageKey,
  getObjectFile,
  isObjectStorageConfigured,
  putObject,
} from '#utils/storage/s3';

const logger = getLogger(['chronos', 'events']);

/** Content types a browser can render, mapped to the extension used in the key. */
const EVENT_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Uploads above this are refused; the banner field states the limit. */
const MAX_EVENT_IMAGE_BYTES = 8 * 1024 * 1024;

async function loadEvent(id: string) {
  const [row] = await db.select().from(event).where(eq(event.id, id));
  if (!row) {
    throw notFound('Event not found');
  }
  return row;
}

export const uploadEventImage = base.events.uploadImage
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const { file, id } = input;
    const existing = await loadEvent(id);

    if (!isObjectStorageConfigured()) {
      throw serviceUnavailable('Object storage is not configured');
    }

    const extension = EVENT_IMAGE_EXTENSIONS[file.type];
    if (!extension) {
      throw badRequest('Unsupported image type');
    }

    if (file.size > MAX_EVENT_IMAGE_BYTES) {
      throw badRequest('The image is too large (max 8 MiB)');
    }

    const key = eventImageKey(id, extension);
    await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type);

    const [updated] = await db
      .update(event)
      .set({
        imageByteSize: file.size,
        imageContentType: file.type,
        imageKey: key,
        imageUpdatedAt: new Date(),
      })
      .where(eq(event.id, id))
      .returning();

    if (!updated) {
      throw notFound('Event not found');
    }

    // Replacing a banner leaves the previous object behind; the row is already
    // correct, so a failed cleanup is logged instead of failing the upload.
    if (existing.imageKey) {
      try {
        await deleteObject(existing.imageKey);
      } catch (error) {
        logger.warn('Failed to delete the replaced event banner', {
          error,
          eventId: id,
          key: existing.imageKey,
          requestId: context.requestId,
        });
      }
    }

    logger.info('event banner uploaded', {
      bytes: file.size,
      eventId: id,
      requestId: context.requestId,
      type: file.type,
    });

    await recordActivity(context, {
      action: 'update',
      entityId: id,
      entityType: 'event',
      metadata: {
        after: { hasBanner: true },
        before: { hasBanner: Boolean(existing.imageKey) },
      },
    });

    return presentEvent(updated, await resolveEventViewer(context.user?.id));
  });

export const deleteEventImage = base.events.deleteImage
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const { id } = input;
    const existing = await loadEvent(id);

    if (!existing.imageKey) {
      throw notFound('Event has no banner');
    }

    const key = existing.imageKey;

    const [updated] = await db
      .update(event)
      .set({
        imageByteSize: null,
        imageContentType: null,
        imageKey: null,
        imageUpdatedAt: null,
      })
      .where(eq(event.id, id))
      .returning();

    if (!updated) {
      throw notFound('Event not found');
    }

    try {
      await deleteObject(key);
    } catch (error) {
      logger.warn('Failed to delete an event banner', {
        error,
        eventId: id,
        key,
        requestId: context.requestId,
      });
    }

    logger.info('event banner removed', {
      eventId: id,
      requestId: context.requestId,
    });

    await recordActivity(context, {
      action: 'update',
      entityId: id,
      entityType: 'event',
      metadata: {
        after: { hasBanner: false },
        before: { hasBanner: true },
      },
    });

    return { id };
  });

export const eventImage = base.events.image.handler(
  async ({ context, input }) => {
    const { id, includeDrafts } = input;
    const includeAll =
      includeDrafts && (await canManageEvents(context.user?.id));
    const [row] = await db
      .select({
        imageContentType: event.imageContentType,
        imageKey: event.imageKey,
        status: event.status,
      })
      .from(event)
      .where(eq(event.id, id));

    // A draft's banner stays as hidden as the draft itself.
    if (
      !(row?.imageKey && row.imageContentType) ||
      (!includeAll && row.status !== 'published')
    ) {
      throw notFound('Image not found');
    }

    if (!isObjectStorageConfigured()) {
      throw serviceUnavailable('Object storage is not configured');
    }

    logger.debug('event banner read', {
      eventId: id,
      requestId: context.requestId,
      status: row.status,
    });

    // Streamed through Chronos rather than redirecting to a presigned URL, the
    // same way the kiosk serves announcement images. The client appends
    // `?v=<imageUpdatedAt>`, which makes a replacement visible despite the cache.
    // A draft banner is only ever served to a manager, so it must not sit in a
    // shared cache.
    context.resHeaders?.set(
      'Cache-Control',
      row.status === 'published' ? 'public, max-age=86400' : 'private, no-store'
    );

    return new File(
      [await getObjectFile(row.imageKey).arrayBuffer()],
      row.imageKey.split('/').pop() ?? id,
      { type: row.imageContentType }
    );
  }
);
