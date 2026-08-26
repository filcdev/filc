import z from 'zod';

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
