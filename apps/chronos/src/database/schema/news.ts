import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { user } from '#database/schema/authentication';
import { cohort } from '#database/schema/timetable';

export const announcement = pgTable('announcement', {
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
  blogPost,
  systemMessage,
  systemMessageCohortMtm,
};
