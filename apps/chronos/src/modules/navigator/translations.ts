import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { navigatorTranslation } from '#modules/navigator/schema';
import { base } from '#orpc';
import { badRequest, notFound } from '#utils/http';

export const listTranslationLanguagesRoute =
  base.navigator.translations.available.handler(async () => {
    const rows = await db
      .selectDistinct({ lang_key: navigatorTranslation.lang_key })
      .from(navigatorTranslation)
      .orderBy(asc(navigatorTranslation.lang_key));

    return { languages: rows.map((row) => row.lang_key) };
  });

export const getTranslationBundleRoute =
  base.navigator.translations.lang.handler(async ({ input }) => {
    const { lang } = input;

    const rows = await db
      .select({
        text: navigatorTranslation.text,
        text_key: navigatorTranslation.text_key,
      })
      .from(navigatorTranslation)
      .where(eq(navigatorTranslation.lang_key, lang));

    return Object.fromEntries(rows.map((row) => [row.text_key, row.text]));
  });

export const listTranslationsRoute = base.navigator.translations.list
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async () => {
    const translations = await db
      .select()
      .from(navigatorTranslation)
      .orderBy(
        asc(navigatorTranslation.text_key),
        asc(navigatorTranslation.lang_key)
      );

    return { translations };
  });

export const createTranslationRoute = base.navigator.translations.create
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { text_key, translations } = input;

    const values = Object.entries(translations).map(([lang_key, text]) => ({
      lang_key,
      text,
      text_key,
    }));

    if (values.length === 0) {
      throw badRequest('At least one translation is required');
    }

    // A single INSERT … ON CONFLICT statement writes every language or, if the
    // statement fails, none of them.
    const rows = await db
      .insert(navigatorTranslation)
      .values(values)
      .onConflictDoUpdate({
        set: { text: sql`excluded.text` },
        target: [navigatorTranslation.lang_key, navigatorTranslation.text_key],
      })
      .returning();

    return { translations: rows };
  });

export const updateTranslationRoute = base.navigator.translations.update
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { key, lang, text } = input;

    const [translation] = await db
      .insert(navigatorTranslation)
      .values({ lang_key: lang, text, text_key: key })
      .onConflictDoUpdate({
        set: { text },
        target: [navigatorTranslation.lang_key, navigatorTranslation.text_key],
      })
      .returning();

    if (!translation) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to write translation',
      });
    }

    return { translation };
  });

export const deleteTranslationRoute = base.navigator.translations.delete
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { key, lang } = input;

    const [translation] = await db
      .delete(navigatorTranslation)
      .where(
        and(
          eq(navigatorTranslation.lang_key, lang),
          eq(navigatorTranslation.text_key, key)
        )
      )
      .returning();

    if (!translation) {
      throw notFound('Translation not found');
    }

    return { translation };
  });
