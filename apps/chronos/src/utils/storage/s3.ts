import { S3Client, type S3File } from 'bun';
import { env } from '#utils/environment';

/** Storage is optional: without a full config, uploads are refused and images cannot be served. */
export const isObjectStorageConfigured = (): boolean =>
  Boolean(
    env.s3AccessKeyId && env.s3Bucket && env.s3Endpoint && env.s3SecretAccessKey
  );

let client: S3Client | null = null;

const s3 = (): S3Client => {
  if (!client) {
    client = new S3Client({
      accessKeyId: env.s3AccessKeyId ?? '',
      bucket: env.s3Bucket ?? '',
      endpoint: env.s3Endpoint ?? '',
      region: env.s3Region,
      secretAccessKey: env.s3SecretAccessKey ?? '',
    });
  }

  return client;
};

/**
 * Object key for one announcement image: a fresh key per upload, so replacing
 * an image never serves stale bytes from a cache.
 */
export const announcementImageKey = (
  announcementId: string,
  extension: string
): string => `news/${announcementId}/${crypto.randomUUID()}${extension}`;

export const putObject = async (
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> => {
  await s3().file(key).write(body, { type: contentType });
};

/** Lazy reference: nothing is requested until the file is read or streamed. */
export const getObjectFile = (key: string): S3File => s3().file(key);

export const deleteObject = async (key: string): Promise<void> => {
  await s3().file(key).delete();
};
