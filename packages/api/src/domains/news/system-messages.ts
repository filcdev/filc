import z from 'zod';
import { listResponse } from '../list';
import {
  blockContentSchema,
  newsAuthorSchema,
  storedNewsContentSchema,
  uniqueIdList,
} from './announcements';

/**
 * The fields a system message is written with. The update shape is this one
 * partial-ed, so a field added here reaches both.
 */
const dateRangeFieldsSchema = z.object({
  cohortIds: uniqueIdList(z.uuid()).optional(),
  content: blockContentSchema,
  title: z.string().min(1),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});

const validRangeMessage = 'validUntil must be on or after validFrom';

export const dateRangeBodySchema = dateRangeFieldsSchema.refine(
  (data) => data.validUntil >= data.validFrom,
  { message: validRangeMessage, path: ['validUntil'] }
);

export type DateRangeBodyInput = z.infer<typeof dateRangeBodySchema>;

export const dateRangeUpdateBodySchema = dateRangeFieldsSchema.partial().refine(
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

export type DateRangeUpdateBodyInput = z.infer<
  typeof dateRangeUpdateBodySchema
>;

/** A `system_message` row exactly as stored. */
export const systemMessageRowSchema = z.object({
  authorId: z.uuid(),
  content: storedNewsContentSchema,
  createdAt: z.date(),
  id: z.uuid(),
  title: z.string(),
  updatedAt: z.date(),
  validFrom: z.date(),
  validUntil: z.date(),
});

/** A system message plus the cohorts it is targeted at. */
export const systemMessageTargetedRowSchema = systemMessageRowSchema.extend({
  cohortIds: z.array(z.uuid()),
});

/** A system message as the list and detail endpoints return it, with its author. */
export const systemMessageItemSchema = systemMessageTargetedRowSchema.extend({
  author: newsAuthorSchema.nullable().optional(),
});

/** Payload of `GET /news/system-messages`. */
export const systemMessageListResponseSchema = listResponse(
  systemMessageItemSchema
);
