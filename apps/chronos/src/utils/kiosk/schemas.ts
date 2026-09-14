import { kioskKindSchema } from '@filcdev/api/domains/kiosk/config';
import z from 'zod';
import { kiosk } from '#database/schema/kiosk';
import { createSelectSchema } from '#utils/zod';

export const kioskSelectSchema = createSelectSchema(kiosk);

const kioskSummarySchema = z.object({
  id: z.uuid(),
  kind: kioskKindSchema,
  name: z.string(),
});

export const kioskListResponseSchema = z.object({
  data: z.object({ kiosks: z.array(kioskSelectSchema) }),
  success: z.literal(true),
});

export const kioskResponseSchema = z.object({
  data: z.object({ kiosk: kioskSelectSchema }),
  success: z.literal(true),
});

/**
 * The heartbeat has three shapes: an unknown box gets `registered: false`, a
 * known box gets its kind/name (plus `config` and `enabled: true` when it is
 * enabled). `config` is deliberately absent for unknown and disabled boxes.
 */
export const kioskHeartbeatResponseSchema = z.object({
  data: z.object({
    enabled: z.boolean().optional(),
    kiosk: kioskSummarySchema
      .extend({ config: z.unknown().optional() })
      .optional(),
    registered: z.boolean(),
  }),
  success: z.literal(true),
});

export const kioskNewsResponseSchema = z.object({
  data: z.object({
    announcements: z.array(
      z.object({
        body: z.string(),
        highlighted: z.boolean(),
        id: z.uuid(),
        imageVersion: z.string().nullable(),
        /** Boxes the takeover is limited to; empty means every kiosk. */
        kioskIds: z.array(z.string()),
        title: z.string(),
        validFrom: z.date(),
        validUntil: z.date(),
      })
    ),
  }),
  success: z.literal(true),
});

export const kioskWeatherResponseSchema = z.object({
  data: z.object({
    icon: z.string(),
    precipMm: z.number(),
    tempC: z.number(),
    windKph: z.number(),
  }),
  success: z.literal(true),
});

export const kioskDeparturesResponseSchema = z.object({
  data: z.object({
    departures: z.array(
      z
        .object({
          label: z.string(),
          predictedDepartureTime: z.number(),
          routeShortDesc: z.string(),
        })
        .nullable()
    ),
  }),
  success: z.literal(true),
});
