import z from 'zod';
import { blockContentSchema, newsAuthorSchema } from './announcements';

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

export type DateRangeBodyInput = z.infer<typeof dateRangeBodySchema>;

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

export type DateRangeUpdateBodyInput = z.infer<
  typeof dateRangeUpdateBodySchema
>;

/** A `system_message` row exactly as stored. */
export const systemMessageRowSchema = z.object({
  authorId: z.uuid(),
  content: z.unknown(),
  createdAt: z.date(),
  id: z.uuid(),
  title: z.string(),
  updatedAt: z.date(),
  validFrom: z.date(),
  validUntil: z.date(),
});

/** A system message plus the cohorts it is targeted at. */
export const systemMessageTargetedRowSchema = systemMessageRowSchema.extend({
  cohortIds: z.array(z.string()),
});

/** A system message as the list and detail endpoints return it, with its author. */
export const systemMessageItemSchema = systemMessageTargetedRowSchema.extend({
  author: newsAuthorSchema.nullable().optional(),
});

/** Payload of `GET /news/system-messages`. */
export const systemMessageListResponseSchema = z.object({
  data: z.array(systemMessageItemSchema),
  total: z.number(),
});
