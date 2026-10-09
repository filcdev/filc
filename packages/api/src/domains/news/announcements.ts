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
  includeAll: z.stringbool().default(false),
  includeExpired: z.stringbool().default(false),
  /** Kiosk-only announcements are hidden on the web unless asked for. */
  includeKioskOnly: z.stringbool().default(false),
});

export type AnnouncementQueryInput = z.infer<typeof announcementQuerySchema>;

export const announcementCreateSchema = z
  .object({
    cohortIds: z.array(z.string()).optional(),
    content: blockContentSchema,
    /** Shown as a full-screen takeover on the TV kiosks. */
    highlighted: z.boolean().optional(),
    /**
     * Kiosks the takeover is limited to; none means every kiosk. The marquee
     * is unaffected either way.
     */
    kioskIds: z.array(z.uuid()).optional(),
    /** Keep it off the web app; the kiosks still show it. */
    kioskOnly: z.boolean().optional(),
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
    /** Shown as a full-screen takeover on the TV kiosks. */
    highlighted: z.boolean().optional(),
    /**
     * Kiosks the takeover is limited to; none means every kiosk. The marquee
     * is unaffected either way.
     */
    kioskIds: z.array(z.uuid()).optional(),
    /** Keep it off the web app; the kiosks still show it. */
    kioskOnly: z.boolean().optional(),
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

/**
 * The announcement image upload body. Only the presence of a file is checked
 * here: the size cap and the mime allowlist are enforced by the route, because
 * zod's file schema validates neither.
 */
export const announcementImageUploadSchema = z.object({ file: z.file() });

/**
 * The author projection every news entity carries: the joined `user` row.
 * Shared by announcements, blog posts and system messages.
 */
export const newsAuthorSchema = z.object({
  id: z.string(),
  image: z.string().nullable(),
  name: z.string(),
});

/** An `announcement` row exactly as stored. */
export const announcementRowSchema = z.object({
  authorId: z.uuid(),
  content: z.unknown(),
  createdAt: z.date(),
  highlighted: z.boolean(),
  id: z.uuid(),
  imageByteSize: z.number().nullable(),
  imageContentType: z.string().nullable(),
  imageKey: z.string().nullable(),
  imageUpdatedAt: z.date().nullable(),
  kioskOnly: z.boolean(),
  title: z.string().nullable(),
  updatedAt: z.date(),
  validFrom: z.date(),
  validUntil: z.date(),
});

/** An announcement plus the cohorts and kiosks it is targeted at. */
export const announcementTargetedRowSchema = announcementRowSchema.extend({
  cohortIds: z.array(z.string()),
  kioskIds: z.array(z.string()),
});

/** An announcement as the list and detail endpoints return it, with its author. */
export const announcementItemSchema = announcementTargetedRowSchema.extend({
  author: newsAuthorSchema.nullable().optional(),
});

/** Payload of `GET /news/announcements`. */
export const announcementListResponseSchema = z.object({
  data: z.array(announcementItemSchema),
  total: z.number(),
});
