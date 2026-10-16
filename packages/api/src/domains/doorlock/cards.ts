import z from 'zod';
import { listResponse } from '../list';

const baseCardPayloadSchema = z.object({
  authorizedDeviceIds: z.array(z.uuid()).default([]),
  enabled: z.boolean().default(true),
  frozen: z.boolean().default(false),
  name: z.string().min(1, 'Card name is required'),
});

/** Payload for creating an access card. */
export const createCardSchema = baseCardPayloadSchema.extend({
  cardData: z.string().min(1, 'Card UID is required'),
  userId: z.uuid().nullable(),
});

/** Payload for updating an access card. */
export const updateCardSchema = baseCardPayloadSchema.extend({
  userId: z.uuid().nullable(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

/** A user eligible to own an access card. */
export const doorlockUserSummarySchema = z.object({
  email: z.string(),
  id: z.uuid(),
  name: z.string(),
  nickname: z.string().nullable(),
});

/** A doorlock device an access card is authorized on. */
export const doorlockDeviceSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

/** An access card with its owner and the devices it opens. */
export const doorlockCardSchema = z.object({
  authorizedDevices: z.array(doorlockDeviceSummarySchema),
  cardData: z.string(),
  createdAt: z.date(),
  enabled: z.boolean(),
  frozen: z.boolean(),
  id: z.uuid(),
  name: z.string(),
  owner: doorlockUserSummarySchema.nullable().optional(),
  updatedAt: z.date(),
  userId: z.uuid().nullable(),
});

export type DoorlockCard = z.infer<typeof doorlockCardSchema>;

/** Payload of `GET /doorlock/cards` and `GET /doorlock/self/cards`. */
export const cardListResponseSchema = listResponse(doorlockCardSchema);

/** Payload of `GET /doorlock/cards/users`. */
export const doorlockUserListResponseSchema = listResponse(
  doorlockUserSummarySchema
);
