import z from 'zod';
import { user } from '#database/schema/authentication';
import { announcement, systemMessage } from '#database/schema/news';
import { createSelectSchema } from '#utils/zod';

/** Shared `author` projection used by announcement/system-message list & detail. */
export const authorSelect = {
  id: user.id,
  image: user.image,
  name: user.name,
};

/**
 * Shared column projection for announcement list & detail, so a new column
 * cannot be forgotten in one of the hand-written selects. Spread the author
 * projection next to it: `{ ...announcementSelect, author: authorSelect }`.
 */
export const announcementSelect = {
  authorId: announcement.authorId,
  content: announcement.content,
  createdAt: announcement.createdAt,
  highlighted: announcement.highlighted,
  id: announcement.id,
  imageByteSize: announcement.imageByteSize,
  imageContentType: announcement.imageContentType,
  imageKey: announcement.imageKey,
  imageUpdatedAt: announcement.imageUpdatedAt,
  kioskOnly: announcement.kioskOnly,
  title: announcement.title,
  updatedAt: announcement.updatedAt,
  validFrom: announcement.validFrom,
  validUntil: announcement.validUntil,
};

export const authorSchema = z.object({
  id: z.string(),
  image: z.string().nullable(),
  name: z.string(),
});

export const resolveTitle = (title: string | null | undefined): string =>
  title && title.length > 0 ? title : 'Untitled';

const announcementSelectSchema = createSelectSchema(announcement);
const systemMessageSelectSchema = createSelectSchema(systemMessage);

export const announcementItemSchema = announcementSelectSchema.extend({
  author: authorSchema.nullable().optional(),
  cohortIds: z.array(z.string()),
  kioskIds: z.array(z.string()),
});

export const systemMessageItemSchema = systemMessageSelectSchema.extend({
  author: authorSchema.nullable().optional(),
  cohortIds: z.array(z.string()),
});

export const announcementListResponseSchema = z.object({
  data: z.array(announcementItemSchema),
  success: z.literal(true),
  total: z.number(),
});

export const systemMessageListResponseSchema = z.object({
  data: z.array(systemMessageItemSchema),
  success: z.literal(true),
  total: z.number(),
});

export const announcementDetailResponseSchema = z.object({
  data: announcementItemSchema,
  success: z.literal(true),
});

export const systemMessageDetailResponseSchema = z.object({
  data: systemMessageItemSchema,
  success: z.literal(true),
});

export const announcementBaseDetailResponseSchema = z.object({
  data: announcementSelectSchema.extend({
    cohortIds: z.array(z.string()),
    kioskIds: z.array(z.string()),
  }),
  success: z.literal(true),
});

export const systemMessageBaseDetailResponseSchema = z.object({
  data: systemMessageSelectSchema.extend({ cohortIds: z.array(z.string()) }),
  success: z.literal(true),
});

export const successResponseSchema = z.object({
  success: z.literal(true),
});
