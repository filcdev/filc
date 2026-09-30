import z from 'zod';
import { kioskKindSchema } from './config';

/** The identifying fields a box needs to learn about itself on a heartbeat. */
export const kioskSummarySchema = z.object({
  id: z.uuid(),
  kind: kioskKindSchema,
  name: z.string(),
});

/**
 * One kiosk registry row as stored. `kind` is text validated in application
 * code (its values are the `kioskKindSchema` enum, but the column is plain
 * text), and `config` is the kind-specific blob the handler validates against
 * that kind — never by this schema.
 */
export const kioskRowSchema = z.object({
  appVersion: z.string().nullable(),
  config: z.unknown(),
  createdAt: z.date(),
  enabled: z.boolean(),
  id: z.uuid(),
  kind: z.string(),
  lastSeenAt: z.date().nullable(),
  lastSeenIp: z.string().nullable(),
  machineId: z.string(),
  name: z.string(),
  updatedAt: z.date(),
});

/** Payload of `GET /kiosk`: every registered box, in name order. */
export const kioskListResponseSchema = z.object({
  kiosks: z.array(kioskRowSchema),
});

/** Payload of the kiosk registry write endpoints: the affected row. */
export const kioskResponseSchema = z.object({
  kiosk: kioskRowSchema,
});

/**
 * Payload of `GET /kiosk/news`: the TV marquee items, in `validUntil` order.
 * `body` is the flattened plain text of the announcement, `imageVersion` is a
 * token the kiosk appends to the image URL (`?v=`) so a replaced image is
 * visible despite the long max-age, and `kioskIds` limits a takeover to
 * specific boxes (empty means every kiosk).
 */
export const kioskNewsResponseSchema = z.object({
  announcements: z.array(
    z.object({
      body: z.string(),
      highlighted: z.boolean(),
      id: z.uuid(),
      imageVersion: z.string().nullable(),
      kioskIds: z.array(z.string()),
      title: z.string(),
      validFrom: z.date(),
      validUntil: z.date(),
    })
  ),
});

/** Payload of `GET /kiosk/weather`: the current conditions shown on the TV. */
export const kioskWeatherResponseSchema = z.object({
  icon: z.string(),
  precipMm: z.number(),
  tempC: z.number(),
  windKph: z.number(),
});

/** Payload of `GET /kiosk/petrik-news`: the navigator slideshow items. */
export const kioskPetrikNewsResponseSchema = z.object({
  items: z.array(
    z.object({
      body: z.string(),
      imageUrl: z.string().nullable(),
      publishedAt: z.string(),
      title: z.string(),
      url: z.string(),
    })
  ),
});

/** Payload of `POST /kiosk/departures`: one entry per configured card, `null` when no stop answered. */
export const kioskDeparturesResponseSchema = z.object({
  departures: z.array(
    z
      .object({
        label: z.string(),
        predictedDepartureTime: z.number(),
        routeShortDesc: z.string(),
      })
      .nullable()
  ),
});
