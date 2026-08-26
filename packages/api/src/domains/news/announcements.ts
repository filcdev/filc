import z from 'zod';

/** A rich-text content block used across news entities. */
export const blockContentSchema = z.array(
  z.object({
    content: z.unknown(),
    type: z.string(),
  })
);

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const announcementQuerySchema = paginationSchema.extend({
  includeExpired: z.coerce.boolean().default(false),
});

export type AnnouncementQueryInput = z.infer<typeof announcementQuerySchema>;

export const announcementCreateSchema = z
  .object({
    cohortIds: z.array(z.string()).optional(),
    content: blockContentSchema,
    title: z.string().min(1).optional(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
  })
  .refine((data) => data.validUntil >= data.validFrom, {
    message: 'validUntil must be on or after validFrom',
    path: ['validUntil'],
  });

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;

export const announcementUpdateSchema = z
  .object({
    cohortIds: z.array(z.string()).optional(),
    content: blockContentSchema.optional(),
    title: z.string().min(1).optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.validFrom && data.validUntil) {
        return data.validUntil >= data.validFrom;
      }
      return true;
    },
    {
      message: 'validUntil must be on or after validFrom',
      path: ['validUntil'],
    }
  );

export type AnnouncementUpdateInput = z.infer<typeof announcementUpdateSchema>;
