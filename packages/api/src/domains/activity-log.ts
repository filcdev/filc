import z from 'zod';
import { listResponse } from './list';

/** Query parameters for listing activity log entries. */
export const activityLogQuerySchema = z.object({
  action: z.string().optional(),
  actorId: z.uuid().optional(),
  entityType: z.string().optional(),
  from: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  to: z.coerce.date().optional(),
});

export type ActivityLogQueryInput = z.infer<typeof activityLogQuerySchema>;

/** A raw activity log row, as stored in the `activity_log` table. */
export const activityLogRowSchema = z.object({
  action: z.string(),
  actorId: z.uuid().nullable(),
  createdAt: z.date(),
  entityId: z.string().nullable(),
  entityType: z.string(),
  id: z.number().int(),
  ipAddress: z.string().nullable(),
  metadata: z.unknown().nullable(),
  userAgent: z.string().nullable(),
});

/** An activity log row with the resolved actor's display fields. */
export const activityLogEntrySchema = activityLogRowSchema.extend({
  actor: z
    .object({
      email: z.string().nullable(),
      id: z.uuid(),
      name: z.string().nullable(),
      nickname: z.string().nullable(),
    })
    .nullable(),
});

/** Payload of `GET /activity-log`. */
export const activityLogListResponseSchema = listResponse(
  activityLogEntrySchema
);
