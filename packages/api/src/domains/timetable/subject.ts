import z from 'zod';

/** A `subject` row; the timestamps are real `Date`s over RPC. */
export const subjectSelectSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  name: z.string(),
  short: z.string(),
  updatedAt: z.date(),
});
