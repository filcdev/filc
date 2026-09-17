import {
  createTranslationSchema,
  langQuerySchema,
  translationParamsSchema,
  updateTranslationSchema,
} from '@filcdev/api/domains/navigator/translation';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { and, asc, eq, sql } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorTranslation } from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import { navigatorFactory } from '#routes/navigator/_factory';
import { badRequest, created, notFound, ok } from '#utils/http';
import {
  languagesResponseSchema,
  translationBundleResponseSchema,
  translationResponseSchema,
  translationsResponseSchema,
} from '#utils/navigator/schemas';
import { filcExt } from '#utils/openapi';

const { schema: createTranslationRequestSchema } = await resolver(
  createTranslationSchema
).toOpenAPISchema();
const { schema: updateTranslationRequestSchema } = await resolver(
  updateTranslationSchema
).toOpenAPISchema();

export const listTranslationLanguagesRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@listof Language'),
    description: 'List the languages the campus translations exist in',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(languagesResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Navigator'],
  }),
  async (c) => {
    const rows = await db
      .selectDistinct({ lang_key: navigatorTranslation.lang_key })
      .from(navigatorTranslation)
      .orderBy(asc(navigatorTranslation.lang_key));

    return ok(c, { languages: rows.map((row) => row.lang_key) });
  }
);

export const getTranslationBundleRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', 'TranslationBundle'),
    description:
      'One language as a flat `text_key -> text` bundle, without a session',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(translationBundleResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Navigator'],
  }),
  zValidator('query', langQuerySchema),
  async (c) => {
    const { lang } = c.req.valid('query');

    const rows = await db
      .select({
        text: navigatorTranslation.text,
        text_key: navigatorTranslation.text_key,
      })
      .from(navigatorTranslation)
      .where(eq(navigatorTranslation.lang_key, lang));

    return ok(
      c,
      Object.fromEntries(rows.map((row) => [row.text_key, row.text]))
    );
  }
);

export const listTranslationsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@listof Translation', true),
    description: 'List every translation row',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(translationsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  async (c) => {
    const translations = await db
      .select()
      .from(navigatorTranslation)
      .orderBy(
        asc(navigatorTranslation.text_key),
        asc(navigatorTranslation.lang_key)
      );

    return ok(c, { translations });
  }
);

export const createTranslationRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@listof Translation', true),
    description: 'Create or replace one codename across every given language',
    requestBody: {
      content: {
        'application/json': {
          schema: createTranslationRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(translationsResponseSchema),
          },
        },
        description: 'Translations created',
      },
      400: { description: 'No translation given' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createTranslationSchema),
  async (c) => {
    const { text_key, translations } = c.req.valid('json');

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

    return created(c, { translations: rows });
  }
);

export const updateTranslationRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Translation', true),
    description: 'Write the text of one codename in one language',
    requestBody: {
      content: {
        'application/json': {
          schema: updateTranslationRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(translationResponseSchema),
          },
        },
        description: 'Translation written',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateTranslationSchema),
  zValidator('param', translationParamsSchema),
  async (c) => {
    const { key, lang } = c.req.valid('param');
    const { text } = c.req.valid('json');

    const [translation] = await db
      .insert(navigatorTranslation)
      .values({ lang_key: lang, text, text_key: key })
      .onConflictDoUpdate({
        set: { text },
        target: [navigatorTranslation.lang_key, navigatorTranslation.text_key],
      })
      .returning();

    return ok(c, { translation });
  }
);

export const deleteTranslationRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Translation', true),
    description: 'Delete one codename in one language',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(translationResponseSchema),
          },
        },
        description: 'Translation deleted',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Translation not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', translationParamsSchema),
  async (c) => {
    const { key, lang } = c.req.valid('param');

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

    return ok(c, { translation });
  }
);
