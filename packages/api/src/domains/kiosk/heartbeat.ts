import z from 'zod';

/**
 * What a box sends on every heartbeat. `machineId` is the box's identity (DMI
 * product UUID, or a MAC fallback) and is the only thing that links it to a
 * kiosk row.
 */
export const kioskHeartbeatRequestSchema = z.object({
  appVersion: z.string().min(1).max(64),
  machineId: z.string().min(1).max(64),
});

export type KioskHeartbeatRequest = z.infer<typeof kioskHeartbeatRequestSchema>;
