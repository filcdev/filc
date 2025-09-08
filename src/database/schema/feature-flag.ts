import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '~/database/helpers';

export const featureFlag = pgTable('feature_flag', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull().unique(),
  description: text().notNull(),
  isEnabled: boolean().notNull().default(false),
  ...timestamps,
});
