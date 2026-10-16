import z from 'zod';
import { listResponse } from '../list';

/**
 * A list of ids with no repeats. A duplicate would hit the targeting table's
 * composite primary key, which surfaces as a 500 — this reports it as the
 * malformed request it is.
 */
export const uniqueIdList = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .refine((ids) => new Set(ids).size === ids.length, 'Ids must be unique');

/**
 * A rich-text content block used across news entities. `content` is JSON
 * rather than a string because what a block carries depends on its `type`.
 */
export const blockContentSchema = z.array(
  z.object({
    content: z.json(),
    type: z.string(),
  })
);

/**
 * The news body as it sits in the `jsonb` column, shared by the three news
 * entities. Rows written before the block editor hold a flat string, later
 * ones the `blockContentSchema` array, so this is read as JSON and normalised
 * by the reader rather than validated into one of the two branches here: a
 * stray legacy shape would fail validation and take the whole list with it.
 */
export const storedNewsContentSchema = z.json();

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

/**
 * The fields an announcement is written with. The update shape is this one
 * partial-ed, so a field added here reaches both instead of having to be
 * remembered in two lists.
 */
const announcementFieldsSchema = z.object({
  cohortIds: uniqueIdList(z.uuid()).optional(),
  content: blockContentSchema,
  /** Shown as a full-screen takeover on the TV kiosks. */
  highlighted: z.boolean().optional(),
  /**
   * Kiosks the takeover is limited to; none means every kiosk. The marquee
   * is unaffected either way.
   */
  kioskIds: uniqueIdList(z.uuid()).optional(),
  /** Keep it off the web app; the kiosks still show it. */
  kioskOnly: z.boolean().optional(),
  title: z.string().min(1).optional(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});

const validRangeMessage = 'validUntil must be on or after validFrom';

export const announcementCreateSchema = announcementFieldsSchema.refine(
  (data) => data.validUntil >= data.validFrom,
  { message: validRangeMessage, path: ['validUntil'] }
);

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;

export const announcementUpdateSchema = announcementFieldsSchema
  .partial()
  .refine(
    // A patch may carry neither bound, so the ordering only applies when both
    // are present.
    (data) => {
      if (data.validFrom && data.validUntil) {
        return data.validUntil >= data.validFrom;
      }
      return true;
    },
    { message: validRangeMessage, path: ['validUntil'] }
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
  id: z.uuid(),
  image: z.string().nullable(),
  name: z.string(),
});

/** An `announcement` row exactly as stored. */
export const announcementRowSchema = z.object({
  authorId: z.uuid(),
  content: storedNewsContentSchema,
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
  cohortIds: z.array(z.uuid()),
  kioskIds: z.array(z.uuid()),
});

/** An announcement as the list and detail endpoints return it, with its author. */
export const announcementItemSchema = announcementTargetedRowSchema.extend({
  author: newsAuthorSchema.nullable().optional(),
});

/** Payload of `GET /news/announcements`. */
export const announcementListResponseSchema = listResponse(
  announcementItemSchema
);
