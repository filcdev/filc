import z from 'zod';

/** Response for the health check ping endpoint. */
export const pingResponseSchema = z.object({
  data: z.object({
    message: z.string(),
  }),
  success: z.boolean(),
});

/** Response for the uptime endpoint. */
export const uptimeResponseSchema = z.object({
  data: z.object({
    pretty: z.string(),
    uptime_ms: z.number(),
  }),
  success: z.boolean(),
});
