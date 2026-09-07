import z from 'zod';

/** Payload for creating a navigator translation entry. */
export const createTranslationSchema = z.object({
  langKey: z.string().min(1).max(10),
  text: z.string().min(1).max(16_000),
  textKey: z.string().min(1).max(190),
});

/** Payload for updating a navigator translation entry. */
export const updateTranslationSchema = z.object({
  text: z.string().min(1).max(16_000).optional(),
});

/** Query parameters for listing translations for a language. */
export const langQuerySchema = z.object({
  lang: z.string().min(1).max(10),
});

/** Path parameters for a translation addressed by language and key. */
export const translationParamsSchema = z.object({
  key: z.string().min(1).max(190),
  lang: z.string().min(1).max(10),
});

export type CreateTranslationInput = z.infer<typeof createTranslationSchema>;
export type UpdateTranslationInput = z.infer<typeof updateTranslationSchema>;
export type LangQueryInput = z.infer<typeof langQuerySchema>;
export type TranslationParamsInput = z.infer<typeof translationParamsSchema>;
