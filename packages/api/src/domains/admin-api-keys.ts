import z from 'zod';

/**
 * Wire schemas for the admin view over every user's API keys.
 *
 * The rows come from better-auth's `apikey` table, which the plugin owns, so
 * the shape here is hand-written to match that table rather than derived from
 * a Drizzle source. The hashed key itself is deliberately absent: nothing
 * outside the plugin needs it, and an admin screen shows the identifying
 * `start`/`prefix` instead.
 */

/** One API key as the admin list renders it, joined with its owner. */
export const adminApiKeySchema = z.object({
  createdAt: z.date(),
  enabled: z.boolean(),
  expiresAt: z.date().nullable(),
  id: z.uuid(),
  lastRequest: z.date().nullable(),
  name: z.string().nullable(),
  ownerEmail: z.string(),
  ownerName: z.string(),
  prefix: z.string().nullable(),
  referenceId: z.string(),
  requestCount: z.number(),
  start: z.string().nullable(),
  updatedAt: z.date(),
});

export type AdminApiKey = z.infer<typeof adminApiKeySchema>;

/** Query parameters for the admin API-key list. */
export const listAdminApiKeysQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  /** Restrict the list to one owner (user id). */
  ownerId: z.uuid().optional(),
  /** Free-text filter over the owner's name/email and the key's name. */
  search: z.string().optional(),
});

export type ListAdminApiKeysQueryInput = z.infer<
  typeof listAdminApiKeysQuerySchema
>;

/** Response payload for the admin API-key list. */
export const adminApiKeyListResponseSchema = z.object({
  apiKeys: z.array(adminApiKeySchema),
  total: z.number(),
});

export type AdminApiKeyListResponse = z.infer<
  typeof adminApiKeyListResponseSchema
>;

/** Path + body for the admin enable/disable toggle. */
export const updateAdminApiKeySchema = z.object({
  enabled: z.boolean(),
  keyId: z.uuid(),
});

export type UpdateAdminApiKeyInput = z.infer<typeof updateAdminApiKeySchema>;

/** Path parameter for admin operations addressed by key id. */
export const adminApiKeyIdParamsSchema = z.object({
  keyId: z.uuid(),
});

export type AdminApiKeyIdParamsInput = z.infer<
  typeof adminApiKeyIdParamsSchema
>;
