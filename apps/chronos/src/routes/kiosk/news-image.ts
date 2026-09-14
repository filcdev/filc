import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { describeRoute } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { announcement } from '#database/schema/news';
import { ApiHttpError, notFound } from '#utils/http';
import { filcExt } from '#utils/openapi';
import { getObjectFile, isObjectStorageConfigured } from '#utils/storage/s3';
import { kioskFactory } from './_factory';

export const kioskNewsImageRoute = kioskFactory.createHandlers(
  describeRoute({
    ...filcExt('Kiosk', '@unit KioskNewsImage'),
    description: 'The image an announcement shows on the kiosk, as stored',
    responses: {
      200: {
        content: {
          'image/*': {
            schema: { format: 'binary', type: 'string' },
          },
        },
        description: 'Announcement image',
      },
      404: { description: 'Image not found' },
      503: { description: 'Object storage is not configured' },
    },
    tags: ['Kiosk'],
  }),
  zValidator('param', z.object({ id: z.uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

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
      throw new ApiHttpError(StatusCodes.SERVICE_UNAVAILABLE, {
        message: 'Object storage is not configured',
      });
    }

    // Streamed through Chronos rather than redirecting to a presigned URL: the
    // kiosk only ever has to reach the API, and the object store need not be
    // exposed to the boxes. The kiosk appends `?v=<imageVersion>` to the URL,
    // which is what makes a replacement visible despite the long max-age.
    return c.body(getObjectFile(item.imageKey).stream(), StatusCodes.OK, {
      'Cache-Control': 'public, max-age=86400',
      'Content-Type': item.imageContentType,
    });
  }
);
