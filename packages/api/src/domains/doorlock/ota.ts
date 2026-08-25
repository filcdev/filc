import z from 'zod';

/** Payload for triggering a firmware OTA update. */
export const otaPayloadSchema = z.object({
  url: z.url('A valid firmware URL is required'),
});

export type OtaPayloadInput = z.infer<typeof otaPayloadSchema>;
