import z from 'zod';

/** Date range filter for timetable exports. */
export const dateRangeQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export type DateRangeQueryInput = z.infer<typeof dateRangeQuerySchema>;
