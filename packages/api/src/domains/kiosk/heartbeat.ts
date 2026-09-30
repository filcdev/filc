import z from 'zod';
import { kioskSummarySchema } from './responses';

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

/**
 * What the box gets back, in three mutually exclusive shapes: an unregistered
 * box learns only that it is unknown, a disabled box also gets its name and
 * kind so it can show why it is idle, and an enabled box additionally gets its
 * stored config. `config` is deliberately absent for unknown and disabled
 * boxes.
 *
 * A plain union, not a discriminated one: `registered` cannot pick a branch on
 * its own, because two of the three shapes are `registered: true` and differ
 * only in `enabled`. The declared order does the discriminating.
 */
export const kioskHeartbeatResponseSchema = z.union([
  z.object({ registered: z.literal(false) }),
  z.object({
    enabled: z.literal(false),
    kiosk: kioskSummarySchema,
    registered: z.literal(true),
  }),
  z.object({
    enabled: z.literal(true),
    kiosk: kioskSummarySchema.extend({ config: z.unknown() }),
    registered: z.literal(true),
  }),
]);
