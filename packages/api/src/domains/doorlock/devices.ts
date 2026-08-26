import z from 'zod';

/** Path parameter for routes addressing a single doorlock device or card by id. */
export const idParamSchema = z.object({ id: z.uuid() });

export type IdParamInput = z.infer<typeof idParamSchema>;

/** Payload for creating or updating a doorlock device. */
export const devicePayloadSchema = z.object({
  apiToken: z.string().min(1, 'API token is required'),
  lastResetReason: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  name: z.string().min(1, 'Device name is required'),
});

export type DevicePayloadInput = z.infer<typeof devicePayloadSchema>;
