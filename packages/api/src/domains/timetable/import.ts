import z from 'zod';

/** Response for timetable XML import. */
export const importResponseSchema = z.object({
  success: z.literal(true),
});

/** A `YYYY-MM-DD` value that is also a real calendar date (e.g. not 2026-02-30). */
const isRealDate = (value: string): boolean => {
  const [year, month, day] = value.split('-').map(Number);
  if (!(year && month && day)) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealDate, 'Must be a valid calendar date');

/** Multipart payload for importing a timetable XML file (Oman or aSc 2012). */
export const importSchema = z.object({
  file: z.file(),
  name: z.string(),
  validFrom: dateString,
  validTo: dateString.optional(),
});

export type ImportTimetableInput = z.infer<typeof importSchema>;
