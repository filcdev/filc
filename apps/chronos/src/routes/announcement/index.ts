import { describeRoute } from 'hono-openapi';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { announcement } from '#database/schema/announcement';
import { announcementFactory } from '#routes/announcement/_factory';

export const listAnnouncements = announcementFactory.createHandlers(
  describeRoute({
    description: 'List all announcements',
    tags: ['Announcement'],
  }),
  async (c) => {
    const announcements = await db.select().from(announcement);

    return c.json<SuccessResponse<typeof announcements>>({
      data: announcements,
      success: true,
    });
  }
);
