import z from 'zod';
import { myLocationSchema } from '../navigator/my-location';

/** The two kiosk page kinds a box can be enrolled as. */
export const kioskKindSchema = z.enum(['tv', 'navigator']);

/** One stop a departure card queries, with an optional route filter. */
export const departureStopSchema = z.object({
  routeFilter: z.string().min(1).nullable().default(null),
  stopId: z.string().min(1),
});

/** One departure card: a label plus the stops it tries in order. */
export const departureGroupSchema = z.object({
  label: z.string().min(1),
  stops: z.array(departureStopSchema).min(1),
});

/** Departure lookup request: the cards the box is currently configured with. */
export const kioskDeparturesRequestSchema = z.object({
  groups: z.array(departureGroupSchema),
});

/**
 * `kind: 'tv'` configuration: the departure cards under the timetable plus the
 * full-screen news takeover. Strict, like the navigator one: a payload carrying
 * the other kind's keys must be a loud 400, not a silent reset of the stored
 * config. The news keys carry defaults so configs stored before they existed
 * stay valid.
 */
export const tvKioskConfigSchema = z.strictObject({
  departures: z.array(departureGroupSchema),
  /** Show highlighted announcements as a full-screen takeover. */
  highlightedNews: z.boolean().default(true),
  /** Show announcement images as a full-screen takeover. */
  newsImages: z.boolean().default(true),
  /**
   * Seconds each takeover item stays on screen. A takeover round shows every
   * featured item once, then hands the screen back to the ticker.
   */
  newsSlideSeconds: z.number().int().min(5).max(120).default(20),
  /** Seconds the ordinary ticker shows between takeover rounds. */
  newsTickerSeconds: z.number().int().min(5).max(600).default(60),
});

/** `kind: 'navigator'` configuration: idle reset plus the initial marker. */
export const navigatorKioskConfigSchema = z.strictObject({
  idleResetMs: z.number().int().min(10_000).max(600_000).default(60_000),
  startLocation: myLocationSchema.nullable().default(null),
});

export type TvKioskConfig = z.infer<typeof tvKioskConfigSchema>;
export type NavigatorKioskConfig = z.infer<typeof navigatorKioskConfigSchema>;
export type KioskKind = z.infer<typeof kioskKindSchema>;
export type DepartureGroup = z.infer<typeof departureGroupSchema>;
export type KioskDeparturesRequest = z.infer<
  typeof kioskDeparturesRequestSchema
>;
