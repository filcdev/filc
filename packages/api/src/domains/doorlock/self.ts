import z from 'zod';
import { doorlockAuditLogSchema } from './logs';

/** Payload for updating the frozen state of a user-owned card. */
export const updateFrozenSchema = z.object({
  frozen: z.boolean(),
});

/** Payload for activating a device with a virtual card. */
export const activateVirtualCardSchema = z.object({
  deviceId: z.uuid().optional(),
});

export type UpdateFrozenInput = z.infer<typeof updateFrozenSchema>;
export type ActivateVirtualCardInput = z.infer<
  typeof activateVirtualCardSchema
>;

/** Payload of `POST /doorlock/self/cards/{id}/activate`. */
export const doorlockActivationResponseSchema = z.object({
  log: doorlockAuditLogSchema,
});
