import z from 'zod';

/** Response for the DB-backed readiness probe in `routes/health`. */
export const healthResponseSchema = z.object({
  data: z.object({
    database: z.literal('up'),
    status: z.literal('ok'),
  }),
  success: z.boolean(),
});
