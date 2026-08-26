import z from 'zod';

/** Response for timetable XML import. */
export const importResponseSchema = z.object({
  success: z.literal(true),
});

/** Multipart payload for importing a timetable from an Oman XML file. */
export const importSchema = z.object({
  name: z.string(),
  omanXml: z.file(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
});

export type ImportTimetableInput = z.infer<typeof importSchema>;
