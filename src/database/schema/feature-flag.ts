import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '~/database/helpers';

export const featureFlag = pgTable('feature_flag', {
  description: text().notNull(),
  id: uuid().defaultRandom().primaryKey(),
  isEnabled: boolean().notNull().default(false),
  name: text().notNull().unique(),
  ...timestamps,
});

export const featureFlagSchema = {
  featureFlag,
};
