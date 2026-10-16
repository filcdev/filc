import z from 'zod';
import { listResponse } from '../list';

/** Path parameter for routes addressing a single doorlock device or card by id. */
export const idParamSchema = z.object({ id: z.uuid() });

export type IdParamInput = z.infer<typeof idParamSchema>;

/** Payload for creating or updating a doorlock device. */
export const devicePayloadSchema = z.object({
  // The token is the device's only credential and grants its card database, so
  // a guessable one is a door. The admin UI generates a UUID; this keeps a
  // hand-typed token in the same strength class.
  apiToken: z
    .string()
    .min(32, 'API token must be at least 32 characters')
    .max(128),
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
export const deviceListResponseSchema = listResponse(doorlockDeviceSchema);

/** Payload of the delete endpoints: the id that was removed. */
export const idResponseSchema = z.object({ id: z.uuid() });
