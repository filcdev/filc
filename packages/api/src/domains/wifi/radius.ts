import z from 'zod';

/** Payload sent by FreeRADIUS to authorize a WiFi client. */
export const radiusAuthorizeRequestSchema = z.object({
  destination: z.string().optional(),
  IP: z.string().optional(),
  NAS: z.string().optional(),
  password: z.string().optional(),
  sharedSecret: z.string().optional(),
  source: z.string(),
  username: z.string(),
});

/** RADIUS control attributes returned for an accepted client. */
export const radiusAuthorizeResponseSchema = z.object({
  'Cleartext-Password': z.string(),
  'control:Cleartext-Password': z.string(),
  'Session-Timeout': z.number().int(),
});

export type RadiusAuthorizeRequest = z.infer<
  typeof radiusAuthorizeRequestSchema
>;
export type RadiusAuthorizeResponse = z.infer<
  typeof radiusAuthorizeResponseSchema
>;
