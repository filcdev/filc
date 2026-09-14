import z from 'zod';

/** One translated string: a codename (`text_key`) in one language. */
export const translationSchema = z.object({
  lang_key: z.string(),
  text: z.string(),
  text_key: z.string(),
});

/** A flat `text_key -> text` bundle for one language. */
export const translationMapSchema = z.record(z.string(), z.string());

/** Payload creating or replacing one codename across several languages. */
export const createTranslationSchema = z.object({
  text_key: z.string().min(1),
  translations: z.record(z.string().min(2).max(10), z.string()),
});

/** Payload updating the text of one codename in one language. */
export const updateTranslationSchema = z.object({ text: z.string() });

export const langQuerySchema = z.object({ lang: z.string().min(2).max(10) });

export const translationParamsSchema = z.object({
  key: z.string().min(1),
  lang: z.string().min(2).max(10),
});

export type Translation = z.infer<typeof translationSchema>;
export type CreateTranslationInput = z.infer<typeof createTranslationSchema>;
export type UpdateTranslationInput = z.infer<typeof updateTranslationSchema>;
