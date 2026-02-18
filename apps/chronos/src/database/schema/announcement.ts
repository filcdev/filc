import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { user } from '#database/schema/authentication';

export const announcement = pgTable('announcement', {
  authorId: uuid('author_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  content: text('content'),
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  validFrom: timestamp('valid_from', { mode: 'date' }).notNull(),
  validTo: timestamp('valid_to', { mode: 'date' }).notNull(),
  ...timestamps,
});

export const announcementSchema = {
  announcement,
};
