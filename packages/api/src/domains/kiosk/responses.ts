import z from 'zod';
import { listResponse } from '../list';
import { kioskConfigBlobSchema, kioskKindSchema } from './config';

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
  config: kioskConfigBlobSchema,
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
export const kioskListResponseSchema = listResponse(kioskRowSchema);

/**
 * One TV marquee item. `body` is the flattened plain text of the announcement,
 * `imageVersion` is a token the kiosk appends to the image URL (`?v=`) so a
 * replaced image is visible despite the long max-age, and `kioskIds` limits a
 * takeover to specific boxes (empty means every kiosk).
 */
export const kioskNewsItemSchema = z.object({
  body: z.string(),
  highlighted: z.boolean(),
  id: z.uuid(),
  imageVersion: z.string().nullable(),
  kioskIds: z.array(z.uuid()),
  title: z.string(),
  validFrom: z.date(),
  validUntil: z.date(),
});

/** Payload of `GET /kiosk/news`: the TV marquee items, in `validUntil` order. */
export const kioskNewsResponseSchema = listResponse(kioskNewsItemSchema);

/** Payload of `GET /kiosk/weather`: the current conditions shown on the TV. */
export const kioskWeatherResponseSchema = z.object({
  icon: z.string(),
  precipMm: z.number(),
  tempC: z.number(),
  windKph: z.number(),
});

/** One navigator slideshow item. */
export const kioskPetrikNewsItemSchema = z.object({
  body: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string(),
  title: z.string(),
  url: z.string(),
});

/** Payload of `GET /kiosk/petrik-news`: the navigator slideshow items. */
export const kioskPetrikNewsResponseSchema = listResponse(
  kioskPetrikNewsItemSchema
);

/** One departure card: `null` when no stop of the group answered. */
export const kioskDepartureSchema = z
  .object({
    label: z.string(),
    predictedDepartureTime: z.number(),
    routeShortDesc: z.string(),
  })
  .nullable();

/** Payload of `POST /kiosk/departures`: one entry per configured card. */
export const kioskDeparturesResponseSchema = listResponse(kioskDepartureSchema);
