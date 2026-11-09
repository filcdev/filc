import {
  AVATAR_EXTENSIONS,
  avatarUrl,
  MAX_AVATAR_BYTES,
} from '@filcdev/api/domains/users';
import { getLogger } from '@logtape/logtape';

import {
  getObjectFile,
  isObjectStorageConfigured,
  putObject,
} from '#utils/storage/s3';

const logger = getLogger(['chronos', 'avatars']);

/** RFC 2397 inline resource, e.g. `data:image/jpeg;base64,…`. */
const INLINE_IMAGE_PREFIX = /^data:/i;

/** `data:<type>;base64,<payload>` — how every provider inlines an image. */
const INLINE_IMAGE_BODY = /^data:([\w/+.-]+);base64,([\s\S]*)$/i;

/** Content type of a stored avatar, from the extension only it can carry. */
const AVATAR_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const isInlineImage = (value: unknown): value is string =>
  typeof value === 'string' && INLINE_IMAGE_PREFIX.test(value);

/**
 * Decodes an inline image into the bytes and content type to store. Providers
 * only ever send base64, so anything else is refused rather than guessed at.
 */
export const parseInlineImage = (
  uri: string
): { bytes: Uint8Array<ArrayBuffer>; contentType: string } | null => {
  const match = INLINE_IMAGE_BODY.exec(uri);
  const contentType = match?.[1]?.toLowerCase();
  const payload = match?.[2];
  if (!(contentType && payload)) {
    return null;
  }

  // Copied into a plain `ArrayBuffer`-backed view: `Buffer` is typed over
  // `ArrayBufferLike`, which `crypto.subtle` will not accept.
  const decoded = Buffer.from(payload, 'base64');
  const bytes = new Uint8Array(decoded.byteLength);
  bytes.set(decoded);

  return { bytes, contentType };
};

/**
 * Stores avatar bytes under their content-addressed name and answers the URL
 * the `user.image` column holds. `null` means nothing was stored: storage is
 * not configured, or the bytes are not an avatar worth keeping.
 *
 * The object is never deleted afterwards. Names are shared by content, so a
 * delete on one user would break every other user with the same picture, and a
 * replaced picture is a handful of kilobytes that the next upload of the same
 * bytes reuses instead of duplicating.
 */
export const storeAvatar = async (
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string
): Promise<string | null> => {
  const extension = AVATAR_EXTENSIONS[contentType];
  if (!extension) {
    logger.warning('Refused an avatar with an unsupported content type', {
      contentType,
    });
    return null;
  }

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) {
    logger.warning('Refused an avatar outside the size range', {
      bytes: bytes.byteLength,
      contentType,
      maxBytes: MAX_AVATAR_BYTES,
    });
    return null;
  }

  if (!isObjectStorageConfigured()) {
    logger.debug('Cannot store an avatar: object storage is not configured');
    return null;
  }

  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const fileName = `${Buffer.from(digest).toString('hex')}${extension}`;
  await putObject(`avatars/${fileName}`, bytes, contentType);
  return avatarUrl(fileName);
};

/**
 * Replaces an inline `data:` image with a stored one. `null` means the image
 * could not be stored and should be dropped rather than kept as bytes: an
 * inline avatar is what made sign-in fail (better-auth#8338) and inflated every
 * user row it touched.
 */
export const storeInlineImage = async (uri: string): Promise<string | null> => {
  const parsed = parseInlineImage(uri);
  if (!parsed) {
    logger.warning('Dropped an inline image that is not base64 encoded', {
      bytes: uri.length,
    });
    return null;
  }

  try {
    const url = await storeAvatar(parsed.bytes, parsed.contentType);
    if (url) {
      logger.info('Stored an inline profile picture', {
        bytes: parsed.bytes.byteLength,
        contentType: parsed.contentType,
        url,
      });
    }
    return url;
  } catch (error) {
    // A provider's picture is a nicety: a storage failure must not fail the
    // sign-in that carries it.
    logger.warning('Failed to store an inline profile picture', {
      bytes: parsed.bytes.byteLength,
      contentType: parsed.contentType,
      error,
    });
    return null;
  }
};

/**
 * Copies a user record with any inline image replaced by a stored one. The
 * record is returned untouched unless `image` is an inline `data:` URI.
 */
export const withStoredImage = async <
  T extends { email?: string | null; image?: string | null },
>(
  user: T,
  event: string
): Promise<T> => {
  if (!isInlineImage(user.image)) {
    return user;
  }

  const url = await storeInlineImage(user.image);
  logger.info('Replaced an inline profile picture', {
    bytes: user.image.length,
    email: user.email ?? null,
    event,
    stored: url !== null,
  });

  return { ...user, image: url };
};

/**
 * Reads a stored avatar as a `File`, ready to answer a file route with.
 * `null` when the extension is unknown or storage is unavailable.
 */
export const readStoredAvatar = async (
  fileName: string
): Promise<File | null> => {
  const contentType = AVATAR_CONTENT_TYPES[fileName.split('.').pop() ?? ''];
  if (!(contentType && isObjectStorageConfigured())) {
    return null;
  }

  return new File(
    [await getObjectFile(`avatars/${fileName}`).arrayBuffer()],
    fileName,
    { type: contentType }
  );
};
