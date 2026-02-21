import { z } from 'zod';

export const pingMessageSchema = z.object({
  data: z.object({
    debug: z.object({
      deviceState: z.coerce.number(),
      errors: z.object({
        db: z.boolean(),
        nfc: z.boolean(),
        ota: z.boolean(),
        sd: z.boolean(),
        wifi: z.boolean(),
      }),
      lastResetReason: z.string(),
    }),
    fwVersion: z.string(),
    ramFree: z.coerce.number(),
    storage: z.object({
      total: z.coerce.number(),
      used: z.coerce.number(),
    }),
    uptime: z.coerce.number(),
  }),
  type: z.literal('ping'),
});

export const cardReadMessageSchema = z.object({
  authorized: z.boolean(),
  name: z.string(),
  type: z.literal('card-read'),
  uid: z.string(),
});

export const incomingMessageSchema = z.discriminatedUnion('type', [
  pingMessageSchema,
  cardReadMessageSchema,
]);

// Zod schemas for outgoing messages
export const syncDatabaseMessageSchema = z.object({
  db: z.array(
    z.object({
      name: z.string(),
      uid: z.string(),
    })
  ),
  type: z.literal('sync-database'),
});

export const openDoorMessageSchema = z.object({
  name: z.string().optional(),
  type: z.literal('open-door'),
});

export const updateMessageSchema = z.object({
  type: z.literal('update'),
  url: z.string().optional(),
});

export const outgoingMessageSchema = z.discriminatedUnion('type', [
  syncDatabaseMessageSchema,
  openDoorMessageSchema,
  updateMessageSchema,
]);

export type IncomingMessage = z.infer<typeof incomingMessageSchema>;

export type OutgoingMessage = z.infer<typeof outgoingMessageSchema>;
