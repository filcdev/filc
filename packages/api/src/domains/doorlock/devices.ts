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

/** A doorlock device row. */
export const doorlockDeviceSchema = z.object({
  apiToken: z.string(),
  createdAt: z.date(),
  id: z.uuid(),
  lastResetReason: z.string().nullable(),
  location: z.string().nullable(),
  name: z.string(),
  updatedAt: z.date(),
});

export type DoorlockDevice = z.infer<typeof doorlockDeviceSchema>;

/** Payload of `GET /doorlock/devices`. */
export const deviceListResponseSchema = z.object({
  devices: z.array(doorlockDeviceSchema),
});

/** Payload of `POST /doorlock/devices` and `PUT /doorlock/devices/{id}`. */
export const deviceResponseSchema = z.object({
  device: doorlockDeviceSchema,
});

/** Payload of the delete endpoints: the id that was removed. */
export const idResponseSchema = z.object({ id: z.uuid() });
