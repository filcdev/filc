import z from 'zod';

/** Payload for `POST /api/bug-report`. */
export const createBugReportSchema = z.object({
  description: z.string().min(10).max(5000),
  metadata: z.record(z.string(), z.unknown()).optional(),
  page: z.string().max(255).optional(),
  subject: z.string().min(3).max(200),
});

export type CreateBugReportInput = z.infer<typeof createBugReportSchema>;
