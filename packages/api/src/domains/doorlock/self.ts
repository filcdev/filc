import z from 'zod';

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
