import z from 'zod';

/** Response for timetable XML import. */
export const importResponseSchema = z.object({
  success: z.literal(true),
});

/** Multipart payload for importing a timetable XML file (Oman or aSc 2012). */
export const importSchema = z.object({
  file: z.file(),
  name: z.string(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type ImportTimetableInput = z.infer<typeof importSchema>;
