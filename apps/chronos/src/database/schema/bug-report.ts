import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { user } from '#database/schema/authentication';

export const bugReport = pgTable(
  'bug_report',
  {
    description: text('description').notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    metadata: jsonb('metadata'),
    page: text('page'),
    reporterEmail: text('reporter_email'),
    reporterId: uuid('reporter_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull().default('open'),
    subject: text('subject').notNull(),
    ...timestamps,
  },
  (t) => [index('bug_report_status_idx').on(t.status)]
);

export const bugReportSchema = {
  bugReport,
};
