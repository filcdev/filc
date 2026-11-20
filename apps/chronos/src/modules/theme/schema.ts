import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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

/**
 * Admin-editable annual windows that override the manually pinned skin while
 * they are in season. A window is a pair of month/day pairs — no year, no cron
 * — and `GET /theme` resolves it against today's wall clock on every request.
 * `theme` stays plain text like `site_theme.theme`; the API layer narrows it to
 * the `siteThemeIds` enum. Easter is not a row: it is a movable feast, so it
 * lives in code (`utils/schedule.ts`) and wins over every row.
 */
export const siteThemeSchedule = pgTable('site_theme_schedule', {
  id: uuid('id').primaryKey().defaultRandom(),
  theme: text('theme').notNull(),
  startMonth: integer('start_month').notNull(),
  startDay: integer('start_day').notNull(),
  endMonth: integer('end_month').notNull(),
  endDay: integer('end_day').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => user.id, {
    onDelete: 'set null',
  }),
});

export const themeSchema = { siteTheme, siteThemeSchedule };
