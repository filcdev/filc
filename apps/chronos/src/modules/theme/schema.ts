import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from '#database/schema/authentication';

/**
 * The single site-wide seasonal theme, applied on top of each visitor's
 * per-user `user_preferences.theme`. One logical row keyed by the constant id
 * `default` — not a general key/value store — so the table holds exactly one
 * admin-chosen skin (`default` | `halloween` | `christmas`).
 */
export const siteTheme = pgTable('site_theme', {
  id: text('id').primaryKey().default('default'),
  theme: text('theme').notNull().default('default'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => user.id, {
    onDelete: 'set null',
  }),
});

export const themeSchema = { siteTheme };
