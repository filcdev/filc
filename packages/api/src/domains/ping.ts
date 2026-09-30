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
