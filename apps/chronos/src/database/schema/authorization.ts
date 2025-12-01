import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';

export const role = pgTable('role', {
  can: jsonb('can').$type<string[]>().notNull().default([]),
  description: text('description'),
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  ...timestamps,
});

export const authorizationSchema = {
  role,
};
