import {
  AVATAR_EXTENSIONS,
  MAX_AVATAR_BYTES,
} from '@filcdev/api/domains/users';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';

import { db } from '@/database';
import { user } from '@/database/schema/authentication';
import { requireAuthentication } from '@/middleware/auth';
import { recordActivity } from '@/modules/activity-log/utils/record';
import { base } from '@/orpc';
import { readStoredAvatar, storeAvatar } from '@/utils/avatars';
import {
  badGateway,
  badRequest,
  notFound,
  serviceUnavailable,
} from '@/utils/http';
import { isObjectStorageConfigured } from '@/utils/storage/s3';

const logger = getLogger(['chronos', 'users', 'avatar']);

/**
 * Serves a stored avatar. The name is the SHA-256 of the bytes, so a URL always
 * means the same picture and can be cached forever.
 */
export const getAvatar = base.users.avatar.get.handler(
  async ({ context, input }) => {
    if (!isObjectStorageConfigured()) {
      throw serviceUnavailable('Object storage is not configured');
    }

    let file: File | null;
    try {
      file = await readStoredAvatar(input.file);
    } catch (error) {
      // The row can outlive the object (a wipe, a bucket change); that is a
      // missing picture, not a broken server.
      logger.warning('Failed to read a stored avatar', {
        error,
        file: input.file,
      });
      file = null;
    }

    if (!file) {
      throw notFound('Avatar not found');
    }

    context.resHeaders?.set(
      'Cache-Control',
      'public, max-age=31536000, immutable'
    );

    return file;
  }
);

/** Replaces the caller's own picture; uploads are content-addressed, so this never overwrites another user's object. */
export const uploadAvatar = base.users.avatar.upload
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const { file } = input;

    if (!AVATAR_EXTENSIONS[file.type]) {
      throw badRequest('Unsupported image type');
    }

    if (file.size > MAX_AVATAR_BYTES) {
      throw badRequest(
        `The image is too large (max ${MAX_AVATAR_BYTES / (1024 * 1024)} MiB)`
      );
    }

    if (!isObjectStorageConfigured()) {
      throw serviceUnavailable('Object storage is not configured');
    }

    const image = await storeAvatar(
      new Uint8Array(await file.arrayBuffer()),
      file.type
    );

    if (!image) {
      throw badGateway('Object storage rejected the image');
    }

    const [updated] = await db
      .update(user)
      .set({ image })
      .where(eq(user.id, context.session.userId))
      .returning({ id: user.id, image: user.image });

    if (!updated) {
      throw notFound('User not found');
    }

    logger.info('Updated a profile picture', {
      bytes: file.size,
      contentType: file.type,
      image,
      requestId: context.requestId,
      userId: updated.id,
    });

    await recordActivity(context, {
      action: 'update',
      entityId: updated.id,
      entityType: 'user',
      metadata: { image: updated.image },
    });

    return updated;
  });

/** Clears the caller's picture; the stored object stays, see `storeAvatar`. */
export const deleteAvatar = base.users.avatar.delete
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const [updated] = await db
      .update(user)
      .set({ image: null })
      .where(eq(user.id, context.session.userId))
      .returning({ id: user.id });

    if (!updated) {
      throw notFound('User not found');
    }

    logger.info('Removed a profile picture', {
      requestId: context.requestId,
      userId: updated.id,
    });

    await recordActivity(context, {
      action: 'update',
      entityId: updated.id,
      entityType: 'user',
      metadata: { image: null },
    });

    return updated;
  });
