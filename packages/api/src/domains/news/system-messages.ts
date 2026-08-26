import z from 'zod';
import { blockContentSchema } from './announcements';

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
