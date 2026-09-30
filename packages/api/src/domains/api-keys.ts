import z from 'zod';

/** Path parameter for API key endpoints addressed by id. */
export const apiKeyIdParamsSchema = z.object({
  id: z.uuid(),
});

export type ApiKeyIdParamsInput = z.infer<typeof apiKeyIdParamsSchema>;

/** Payload for creating a new API key. */
export const createApiKeySchema = z.object({
  expiresAt: z.coerce.date().optional(),
  name: z.string().min(1, 'Name is required').max(64),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/** An API key row; the key hash never leaves the server. */
export const apiKeySelectSchema = z.object({
  createdAt: z.date(),
  expiresAt: z.date().nullable(),
  id: z.uuid(),
  lastUsedAt: z.date().nullable(),
  name: z.string(),
  prefix: z.string(),
  updatedAt: z.date(),
  userId: z.uuid(),
});

export type ApiKeySelect = z.infer<typeof apiKeySelectSchema>;

/** Response payload for listing the caller's API keys. */
export const apiKeyListResponseSchema = z.object({
  apiKeys: z.array(apiKeySelectSchema),
});

/** Response payload for creating an API key: the row plus the one-time raw secret. */
export const apiKeyResponseSchema = z.object({
  apiKey: apiKeySelectSchema,
  rawKey: z.string(),
});
