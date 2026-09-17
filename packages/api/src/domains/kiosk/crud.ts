import z from 'zod';
import { kioskKindSchema } from './config';

/**
 * Payload for enrolling a box. `config` is validated against `kind` in the
 * handler: the discriminator and the blob arrive as separate fields, so a
 * single zod object could not discriminate them.
 */
export const createKioskSchema = z.object({
  config: z.unknown().optional(),
  kind: kioskKindSchema,
  machineId: z.string().min(1).max(64),
  name: z.string().min(1),
});

export const updateKioskSchema = z.object({
  config: z.unknown().optional(),
  enabled: z.boolean().optional(),
  kind: kioskKindSchema.optional(),
  name: z.string().min(1).optional(),
});

/** Path parameter for kiosk rows, whose ids are server-generated uuids. */
export const kioskIdParamsSchema = z.object({ id: z.uuid() });

export type CreateKioskInput = z.infer<typeof createKioskSchema>;
export type UpdateKioskInput = z.infer<typeof updateKioskSchema>;
