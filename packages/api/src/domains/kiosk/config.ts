import z from 'zod';
import { myLocationSchema } from '../navigator/my-location';

/** The two kiosk page kinds a box can be enrolled as. */
export const kioskKindSchema = z.enum(['tv', 'navigator']);

/** Idle time before the navigator's petrik.hu news slideshow takes over. */
export const DEFAULT_PETRIK_NEWS_IDLE_SECONDS = 120;
/** How long one petrik.hu news item stays on screen. */
export const DEFAULT_PETRIK_NEWS_DWELL_SECONDS = 20;
/** Default petrik.hu RSS feed for the navigator news slideshow. */
export const DEFAULT_PETRIK_NEWS_FEED_URL =
  'https://petrik.hu/kategoria/hirek/feed/';
/** Default number of posts the petrik.hu news slideshow shows. */
export const DEFAULT_PETRIK_NEWS_MAX_ITEMS = 10;
/** Idle time before the navigator resets to the default view, in seconds. */
export const DEFAULT_IDLE_RESET_SECONDS = 60;
/** Whether the petrik.hu news slideshow is enabled by default. */
export const DEFAULT_PETRIK_NEWS_ENABLED = false;

/** Only https feed URLs are allowed for the petrik.hu news slideshow. */
const HTTPS_URL_RE = /^https:\/\//i;

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

/** The keys the legacy migration reads and rewrites on a stored config blob. */
type LegacyNavigatorConfig = {
  idleResetMs?: unknown;
  idleResetSeconds?: unknown;
  petrikNewsEnabled?: unknown;
};

/**
 * Migrates a `navigator` config blob persisted before the petrik.hu news
 * takeover existed. The earliest boxes stored the idle reset as `idleResetMs`
 * (milliseconds); it is now `idleResetSeconds` (seconds), so the legacy key is
 * rounded, clamped to the field's 10–600 range, and removed before the strict
 * schema runs. A pre-existing box must opt in to the news takeover explicitly,
 * so a migrated config defaults `petrikNewsEnabled` to `false` rather than
 * switching the feature on silently. Non-finite legacy values are ignored and
 * fall through to the schema's own defaults.
 */
function migrateLegacyNavigatorConfig(input: unknown): unknown {
  if (input === null || typeof input !== 'object') {
    return input;
  }
  const source = input as LegacyNavigatorConfig;
  if (!('idleResetMs' in source) || 'idleResetSeconds' in source) {
    return input;
  }
  // Copy before rewriting so a failed validation never leaves the caller's
  // object mutated.
  const value = { ...source };
  const rawMs = value.idleResetMs;
  if (typeof rawMs === 'number' && Number.isFinite(rawMs)) {
    const seconds = Math.round(rawMs / 1000);
    value.idleResetSeconds = Math.min(600, Math.max(10, seconds));
  }
  // biome-ignore lint/performance/noDelete: the legacy millisecond key must not survive into the strict schema
  delete value.idleResetMs;
  if (!('petrikNewsEnabled' in value)) {
    value.petrikNewsEnabled = false;
  }
  return value;
}

/**
 * `kind: 'navigator'` configuration: idle reset (in seconds), the petrik.hu
 * news takeover (on/off switch, idle timeout, per-item dwell, feed URL, max
 * item count), and the initial marker. The news keys carry defaults so configs
 * stored before they existed stay valid; the preprocess also migrates the even
 * older `idleResetMs` millisecond key. Strict, so unknown keys still fail
 * loudly.
 */
export const navigatorKioskConfigSchema = z.preprocess(
  migrateLegacyNavigatorConfig,
  z.strictObject({
    idleResetSeconds: z
      .number()
      .int()
      .min(10)
      .max(600)
      .default(DEFAULT_IDLE_RESET_SECONDS),
    /** How long one news item stays on screen, in seconds. */
    petrikNewsDwellSeconds: z
      .number()
      .int()
      .min(5)
      .max(120)
      .default(DEFAULT_PETRIK_NEWS_DWELL_SECONDS),
    /** Whether the petrik.hu news slideshow is enabled at all. */
    petrikNewsEnabled: z.boolean().default(DEFAULT_PETRIK_NEWS_ENABLED),
    /** RSS feed URL for the petrik.hu news slideshow. */
    petrikNewsFeedUrl: z
      .url()
      .refine((value) => HTTPS_URL_RE.test(value), {
        message: 'Only https feed URLs are supported',
      })
      .default(DEFAULT_PETRIK_NEWS_FEED_URL),
    /** Idle time before the petrik.hu news slideshow takes over, in seconds. */
    petrikNewsIdleSeconds: z
      .number()
      .int()
      .min(10)
      .max(600)
      .default(DEFAULT_PETRIK_NEWS_IDLE_SECONDS),
    /** How many posts the petrik.hu news slideshow shows. */
    petrikNewsMaxItems: z
      .number()
      .int()
      .min(1)
      .max(30)
      .default(DEFAULT_PETRIK_NEWS_MAX_ITEMS),
    startLocation: myLocationSchema.nullable().default(null),
  })
);

export type TvKioskConfig = z.infer<typeof tvKioskConfigSchema>;
export type NavigatorKioskConfig = z.infer<typeof navigatorKioskConfigSchema>;
export type KioskKind = z.infer<typeof kioskKindSchema>;
export type DepartureGroup = z.infer<typeof departureGroupSchema>;
export type KioskDeparturesRequest = z.infer<
  typeof kioskDeparturesRequestSchema
>;
