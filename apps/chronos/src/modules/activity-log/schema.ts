import { index, jsonb, pgTable, serial, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { user } from '#database/schema/authentication';

/**
 * Generic audit trail for admin mutations. Rows are best-effort: a failed
 * insert logs a warning and never fails the handler that produced the action.
 */
export const activityLog = pgTable(
  'activity_log',
  {
    action: text('action').notNull(),
    actorId: uuid('actor_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamps.createdAt,
    entityId: text('entity_id'),
    entityType: text('entity_type').notNull(),
    id: serial('id').primaryKey(),
    ipAddress: text('ip_address'),
    metadata: jsonb('metadata'),
    userAgent: text('user_agent'),
  },
  (t) => [
    index('activity_log_actor_id_idx').on(t.actorId),
    index('activity_log_created_at_idx').on(t.createdAt),
    index('activity_log_entity_type_idx').on(t.entityType),
  ]
);

export const activityLogSchema = { activityLog };
