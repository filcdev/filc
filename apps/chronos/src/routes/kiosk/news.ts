import { and, asc, isNotNull, sql } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import {
  announcement,
  announcementCohortMtm,
  announcementKioskMtm,
} from '#database/schema/news';
import { ok } from '#utils/http';
import { kioskNewsResponseSchema } from '#utils/kiosk/schemas';
import {
  activeAnnouncementConditions,
  flattenAnnouncementContent,
} from '#utils/news/announcements';
import { filcExt } from '#utils/openapi';
import { kioskFactory } from './_factory';

export const kioskNewsRoute = kioskFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Kiosk',
      '@unit KioskNewsResponse @field(.announcements, List<KioskAnnouncement>)'
    ),
    description:
      'Active, titled, non-cohort-scoped announcements for the TV kiosk marquee',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(kioskNewsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Kiosk'],
  }),
  async (c) => {
    const now = new Date();

    const announcements = await db
      .select({
        body: announcement.content,
        highlighted: announcement.highlighted,
        id: announcement.id,
        imageUpdatedAt: announcement.imageUpdatedAt,
        title: announcement.title,
        validFrom: announcement.validFrom,
        validUntil: announcement.validUntil,
      })
      .from(announcement)
      .where(
        and(
          isNotNull(announcement.title),
          sql`NOT EXISTS (
            SELECT 1 FROM ${announcementCohortMtm}
            WHERE ${announcementCohortMtm.announcementId} = ${announcement.id}
          )`,
          ...activeAnnouncementConditions(now)
        )
      )
      .orderBy(asc(announcement.validUntil))
      .limit(10);

    // Which boxes each takeover is meant for; a box with no rows for an item
    // shows it too, so an untargeted announcement stays on every screen.
    const itemIds = announcements.map((item) => item.id);
    const kioskMappings =
      itemIds.length > 0
        ? await db
            .select()
            .from(announcementKioskMtm)
            .where(sql`${announcementKioskMtm.announcementId} IN ${itemIds}`)
        : [];

    // The takeover shows the same items as the marquee, so the feed carries
    // what it takes to render them full screen: the flattened text and a
    // version token for the image URL. Order stays `validUntil asc`.
    return ok(c, {
      announcements: announcements.map((item) => ({
        body: flattenAnnouncementContent(item.body),
        highlighted: item.highlighted,
        id: item.id,
        imageVersion: item.imageUpdatedAt?.toISOString() ?? null,
        kioskIds: kioskMappings
          .filter((m) => m.announcementId === item.id)
          .map((m) => m.kioskId),
        title: item.title,
        validFrom: item.validFrom,
        validUntil: item.validUntil,
      })),
    });
  }
);
