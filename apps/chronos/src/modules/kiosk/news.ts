import { and, asc, isNotNull, sql } from 'drizzle-orm';
import { db } from '#database';
import {
  announcement,
  announcementCohortMtm,
  announcementKioskMtm,
} from '#modules/news/schema';
import {
  activeAnnouncementConditions,
  flattenAnnouncementContent,
} from '#modules/news/utils/announcements';
import { base } from '#orpc';

export const listNews = base.kiosk.news.list.handler(async () => {
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
  // `title` is nullable in the table but the query above only matches titled
  // announcements; the filter makes that visible to the type system.
  const titled = announcements.filter(
    (item): item is (typeof announcements)[number] & { title: string } =>
      item.title !== null
  );

  return {
    announcements: titled.map((item) => ({
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
  };
});
