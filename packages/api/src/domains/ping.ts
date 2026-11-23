import z from 'zod';

/** Response payload for the health check ping endpoint. */
export const pingResponseSchema = z.object({
  message: z.string(),
});

/** Response payload for the uptime endpoint. */
export const uptimeResponseSchema = z.object({
  pretty: z.string(),
  uptime_ms: z.number(),
});

/** Response payload for the server time endpoint. */
export const serverTimeResponseSchema = z.object({
  /** Calendar date in the school timezone, `YYYY-MM-DD`. */
  date: z.string(),
  /** Absolute instant, UTC ISO-8601. */
  iso: z.string(),
  /** UTC offset of the configured zone at that instant, in minutes. */
  offsetMinutes: z.number(),
  /** IANA name of the school timezone the API is configured with (`CHRONOS_TIME_ZONE`, `Europe/Budapest` by default). */
  timeZone: z.string(),
  /** Same instant as Unix epoch milliseconds. */
  unixMs: z.number(),
});
export type ServerTimeResponse = z.infer<typeof serverTimeResponseSchema>;
