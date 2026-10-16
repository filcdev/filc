import z from 'zod';

/** Response payload for the DB-backed readiness probe in `routes/health`. */
export const healthResponseSchema = z.object({
  database: z.literal('up'),
  status: z.literal('ok'),
});
