import { sql } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';

export const role = pgTable('role', {
  can: text('can').notNull().array().default(sql`ARRAY[]::text[]`),
  description: text('description'),
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  ...timestamps,
});

export const authorizationSchema = {
  role,
};
