import z from 'zod';
import { blockContentSchema, newsAuthorSchema } from './announcements';

export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase alphanumeric with hyphens'
  );

export const blogCreateSchema = z.object({
  content: blockContentSchema,
  slug: slugSchema.optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  title: z.string().min(1),
});

export type BlogCreateInput = z.infer<typeof blogCreateSchema>;

export const blogUpdateSchema = z.object({
  content: blockContentSchema.optional(),
  slug: slugSchema.optional(),
  title: z.string().min(1).optional(),
});

export type BlogUpdateInput = z.infer<typeof blogUpdateSchema>;

/** A `blog_post` row exactly as stored. */
export const blogPostRowSchema = z.object({
  authorId: z.uuid(),
  content: z.unknown(),
  createdAt: z.date(),
  id: z.uuid(),
  publishedAt: z.date().nullable(),
  slug: z.string(),
  status: z.string(),
  title: z.string(),
  updatedAt: z.date(),
});

/** A blog post as the list and detail endpoints return it, with its author. */
export const blogPostItemSchema = blogPostRowSchema.extend({
  author: newsAuthorSchema.nullable().optional(),
});

/** Payload of `GET /news/blogs` and `GET /news/blogs/drafts`. */
export const blogListResponseSchema = z.object({
  data: z.array(blogPostItemSchema),
  total: z.number(),
});
