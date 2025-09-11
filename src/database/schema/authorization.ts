import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '~/database/helpers';

export const role = pgTable('role', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  can: jsonb('can').$type<string[]>().notNull().default([]),
  ...timestamps,
});

export const authorizationSchema = {
  role,
};
