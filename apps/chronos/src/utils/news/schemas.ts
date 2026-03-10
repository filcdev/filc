import { z } from 'zod';

export const blockContentSchema = z.array(
  z.object({
    content: z.unknown(),
    type: z.string(),
  })
);

export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase alphanumeric with hyphens'
  );

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const dateRangeBodySchema = z
  .object({
    cohortIds: z.array(z.string()).optional(),
    content: blockContentSchema,
    title: z.string().min(1),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
  })
  .refine((data) => data.validUntil >= data.validFrom, {
    message: 'validUntil must be on or after validFrom',
    path: ['validUntil'],
  });

export const dateRangeUpdateBodySchema = z
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

export const announcementQuerySchema = paginationSchema.extend({
  includeExpired: z.coerce.boolean().default(false),
});

export const blogCreateSchema = z.object({
  content: blockContentSchema,
  slug: slugSchema.optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  title: z.string().min(1),
});

export const blogUpdateSchema = z.object({
  content: blockContentSchema.optional(),
  slug: slugSchema.optional(),
  title: z.string().min(1).optional(),
});

export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const ensureUniqueSlug = async (
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> => {
  let slug = baseSlug;
  let counter = 2;

  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};
