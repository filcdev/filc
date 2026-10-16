import z from 'zod';

/** Payload for `POST /api/bug-report`. */
export const createBugReportSchema = z.object({
  description: z.string().min(10).max(5000),
  // Bounded like the sibling text fields: the column is jsonb and the caller
  // is any signed-in user, so an unbounded record is an unbounded write.
  metadata: z
    .record(z.string().max(64), z.unknown())
    .refine(
      (value) => JSON.stringify(value).length <= 4096,
      'Metadata must serialize to at most 4096 characters'
    )
    .optional(),
  page: z.string().max(255).optional(),
  subject: z.string().min(3).max(200),
});

export type CreateBugReportInput = z.infer<typeof createBugReportSchema>;

/** The statuses a bug report moves through (mirrors the Chronos Drizzle table). */
export const bugReportStatuses = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;

export type BugReportStatus = (typeof bugReportStatuses)[number];

/** A bug report status value. */
export const bugReportStatusSchema = z.enum(bugReportStatuses);

/** Path parameter for bug-report endpoints addressed by id. */
export const bugReportIdParamsSchema = z.object({ id: z.uuid() });

/** Query parameters for listing bug reports. */
export const bugReportListQuerySchema = z.object({
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().max(200).optional(),
  status: bugReportStatusSchema.optional(),
});

/** Path + body for `PATCH /bug-report/{id}/status`. */
export const updateBugReportStatusInputSchema = bugReportIdParamsSchema.extend({
  status: bugReportStatusSchema,
});

/**
 * A bug report row, as stored in the `bug_report` table. `metadata` is a
 * `jsonb` column, which Drizzle types as `unknown` — anything JSON-serialisable
 * is allowed there.
 */
export const bugReportSelectSchema = z.object({
  createdAt: z.date(),
  description: z.string(),
  id: z.uuid(),
  metadata: z.unknown(),
  page: z.string().nullable(),
  reporterEmail: z.string().nullable(),
  reporterId: z.uuid().nullable(),
  status: z.string(),
  subject: z.string(),
  updatedAt: z.date(),
});

export type BugReportSelect = z.infer<typeof bugReportSelectSchema>;

/** Response payload for listing bug reports. */
export const bugReportListResponseSchema = z.object({
  reports: z.array(bugReportSelectSchema),
  total: z.number(),
});
