import { eq } from 'drizzle-orm';
import { db } from '#database';
import { announcement } from '#modules/news/schema';
import { base } from '#orpc';
import { notFound, serviceUnavailable } from '#utils/http';
import { getObjectFile, isObjectStorageConfigured } from '#utils/storage/s3';

export const newsImage = base.kiosk.news.image.handler(
  async ({ context, input }) => {
    const { id } = input;

    const [item] = await db
      .select({
        imageContentType: announcement.imageContentType,
        imageKey: announcement.imageKey,
      })
      .from(announcement)
      .where(eq(announcement.id, id));

    if (!(item?.imageKey && item.imageContentType)) {
      throw notFound('Image not found');
    }

    if (!isObjectStorageConfigured()) {
      throw serviceUnavailable('Object storage is not configured');
    }

    // Streamed through Chronos rather than redirecting to a presigned URL: the
    // kiosk only ever has to reach the API, and the object store need not be
    // exposed to the boxes. The kiosk appends `?v=<imageVersion>` to the URL,
    // which is what makes a replacement visible despite the long max-age.
    context.resHeaders?.set('Cache-Control', 'public, max-age=86400');

    return new File(
      [await getObjectFile(item.imageKey).arrayBuffer()],
      item.imageKey.split('/').pop() ?? id,
      { type: item.imageContentType }
    );
  }
);
