import z from 'zod';

/** The multipart body an admin uploads to restore a navigator export. */
export const navigatorImportUploadSchema = z.object({ file: z.file() });

export type NavigatorImportUploadInput = z.infer<
  typeof navigatorImportUploadSchema
>;

/**
 * Row counts of one navigator import, per collection: what the payload
 * carried, not what the transaction changed (rows absent from the payload are
 * never deleted).
 */
export const navigatorImportResultSchema = z.object({
  buildings: z.number().int(),
  classrooms: z.number().int(),
  classroomTypes: z.number().int(),
  corridors: z.number().int(),
  lifts: z.number().int(),
  stairs: z.number().int(),
  translations: z.number().int(),
});

export type NavigatorImportResult = z.infer<typeof navigatorImportResultSchema>;
