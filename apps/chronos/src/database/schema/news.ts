import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { user } from '#database/schema/authentication';
import { kiosk } from '#database/schema/kiosk';
import { cohort } from '#database/schema/timetable';

export const announcement = pgTable(
  'announcement',
  {
    authorId: uuid('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'set null' }),
    content: jsonb('content').notNull(),
    /** Shown as a full-screen takeover on the TV kiosks. */
    highlighted: boolean('highlighted').notNull().default(false),
    id: uuid('id').primaryKey().defaultRandom(),
    /** Bytes of the stored image; the object itself lives in S3. */
    imageByteSize: integer('image_byte_size'),
    imageContentType: text('image_content_type'),
    /** S3 object key; also the flag that an image exists. */
    imageKey: text('image_key'),
    /** Bumped on every upload; the kiosk's cache-busting token. */
    imageUpdatedAt: timestamp('image_updated_at'),
    /** Hidden from the web app: the announcement shows on kiosks only. */
    kioskOnly: boolean('kiosk_only').notNull().default(false),
    title: text('title'),
    validFrom: timestamp('valid_from').notNull(),
    validUntil: timestamp('valid_until').notNull(),
    ...timestamps,
  },
  // The four image columns describe one object, so a half-written row (key
  // without its content type, or the reverse) must be impossible.
  (t) => [
    check(
      'announcement_image_complete',
      sql`(${t.imageKey} IS NULL) = (${t.imageContentType} IS NULL)
        AND (${t.imageKey} IS NULL) = (${t.imageByteSize} IS NULL)
        AND (${t.imageKey} IS NULL) = (${t.imageUpdatedAt} IS NULL)`
    ),
  ]
);

export const systemMessage = pgTable('system_message', {
  authorId: uuid('author_id')
    .notNull()
    .references(() => user.id, { onDelete: 'set null' }),
  content: jsonb('content').notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  validFrom: timestamp('valid_from').notNull(),
  validUntil: timestamp('valid_until').notNull(),
  ...timestamps,
});

export const blogPost = pgTable('blog_post', {
  authorId: uuid('author_id')
    .notNull()
    .references(() => user.id, { onDelete: 'set null' }),
  content: jsonb('content').notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  publishedAt: timestamp('published_at'),
  slug: text('slug').notNull().unique(),
  status: text('status').notNull().default('draft'),
  title: text('title').notNull(),
  ...timestamps,
});

export const announcementCohortMtm = pgTable(
  'announcement_cohort_mtm',
  {
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => announcement.id, { onDelete: 'cascade' }),
    cohortId: text('cohort_id')
      .notNull()
      .references(() => cohort.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.announcementId, t.cohortId] }),
    index('announcement_cohort_mtm_announcement_id_idx').on(t.announcementId),
    index('announcement_cohort_mtm_cohort_id_idx').on(t.cohortId),
  ]
);

/**
 * Which boxes a full-screen announcement takeover appears on. No rows means
 * every kiosk, so an untargeted announcement keeps behaving as before.
 */
export const announcementKioskMtm = pgTable(
  'announcement_kiosk_mtm',
  {
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => announcement.id, { onDelete: 'cascade' }),
    kioskId: uuid('kiosk_id')
      .notNull()
      .references(() => kiosk.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.announcementId, t.kioskId] }),
    index('announcement_kiosk_mtm_announcement_id_idx').on(t.announcementId),
    index('announcement_kiosk_mtm_kiosk_id_idx').on(t.kioskId),
  ]
);

export const systemMessageCohortMtm = pgTable(
  'system_message_cohort_mtm',
  {
    cohortId: text('cohort_id')
      .notNull()
      .references(() => cohort.id, { onDelete: 'cascade' }),
    systemMessageId: uuid('system_message_id')
      .notNull()
      .references(() => systemMessage.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.systemMessageId, t.cohortId] }),
    index('system_message_cohort_mtm_system_message_id_idx').on(
      t.systemMessageId
    ),
    index('system_message_cohort_mtm_cohort_id_idx').on(t.cohortId),
  ]
);

export const newsSchema = {
  announcement,
  announcementCohortMtm,
  announcementKioskMtm,
  blogPost,
  systemMessage,
  systemMessageCohortMtm,
};
