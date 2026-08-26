import z from 'zod';
import { blockContentSchema } from './announcements';

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
