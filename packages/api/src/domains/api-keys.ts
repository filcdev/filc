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
