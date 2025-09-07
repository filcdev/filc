import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '~/database/helpers';
import { user } from '~/database/schema/authentication';

export const card = pgTable('card', {
  id: uuid('id').primaryKey().defaultRandom(),
  tag: text('tag').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  frozen: boolean('frozen').notNull().default(false),
  disabled: boolean('disabled').notNull().default(false),
  label: text('label'),
  ...timestamps,
});

export const doorlockSchema = {
  card,
};
