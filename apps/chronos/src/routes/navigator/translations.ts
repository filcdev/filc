import {
  createTranslationSchema,
  langQuerySchema,
  translationParamsSchema,
  updateTranslationSchema,
} from '@filcdev/api/domains/navigator/translation';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { and, asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorTranslation } from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import { created, internalServerError, notFound, ok } from '#utils/http';
import { pickDefined } from '#utils/navigator/pick-defined';
import {
  translationAvailableResponseSchema,
  translationMapResponseSchema,
  translationResponseSchema,
  translationsResponseSchema,
} from '#utils/navigator/schemas';
import {
  assertTranslationKeyUnique,
  conflictOnUniqueViolation,
} from '#utils/navigator/uniqueness';
import { filcExt } from '#utils/openapi';
import { navigatorFactory } from './_factory';

const { schema: createTranslationRequestSchema } = await resolver(
  createTranslationSchema
).toOpenAPISchema();
const { schema: updateTranslationRequestSchema } = await resolver(
  updateTranslationSchema
).toOpenAPISchema();

const translationParams = [
  { in: 'path', name: 'lang', required: true, schema: { type: 'string' } },
  { in: 'path', name: 'key', required: true, schema: { type: 'string' } },
] as const;

export const listTranslationsByLangRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit TranslationMapResponse'),
    description:
      'List navigator translations for a language as a flat textKey -> text map.',
    parameters: [
      { in: 'query', name: 'lang', required: true, schema: { type: 'string' } },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(translationMapResponseSchema),
          },
        },
        description: 'Translation map for the requested language',
      },
      400: { description: 'Missing language code' },
    },
    tags: ['Navigator'],
  }),
  zValidator('query', langQuerySchema),
  async (c) => {
    const { lang } = c.req.valid('query');

    const rows = await db
      .select()
      .from(navigatorTranslation)
      .where(eq(navigatorTranslation.langKey, lang));

    const flatMap = Object.fromEntries(
      rows.map((row) => [row.textKey, row.text])
    );

    return ok(c, flatMap);
  }
);

export const listAvailableTranslationLangsRoute =
  navigatorFactory.createHandlers(
    describeRoute({
      ...filcExt('Navigator', '@unit TranslationAvailableResponse'),
      description:
        'List the distinct language keys available for navigator translations.',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: resolver(translationAvailableResponseSchema),
            },
          },
          description: 'List of available language keys',
        },
      },
      tags: ['Navigator'],
    }),
    async (c) => {
      const rows = await db
        .select({ langKey: navigatorTranslation.langKey })
        .from(navigatorTranslation)
        .orderBy(asc(navigatorTranslation.langKey));

      const langKeys = Array.from(new Set(rows.map((row) => row.langKey)));

      return ok(c, langKeys);
    }
  );

export const listTranslationsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit TranslationListResponse @field(.translations, List<Translation>)',
      true
    ),
    description: 'List all navigator translation entries',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(translationsResponseSchema),
          },
        },
        description: 'List of translations',
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
        asc(navigatorTranslation.langKey),
        asc(navigatorTranslation.textKey)
      );

    return ok(c, { translations });
  }
);

export const createTranslationRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit TranslationResponse @field(.translation, Translation)',
      true
    ),
    description: 'Create a new navigator translation entry',
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
            schema: resolver(translationResponseSchema),
          },
        },
        description: 'Translation created',
      },
      409: {
        description:
          'A translation with this key already exists in this language',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createTranslationSchema),
  async (c) => {
    const payload = c.req.valid('json');

    await assertTranslationKeyUnique(db, payload.langKey, payload.textKey);

    try {
      const [inserted] = await db
        .insert(navigatorTranslation)
        .values(payload)
        .returning();

      if (!inserted) {
        throw internalServerError('Failed to create translation');
      }

      return created(c, { translation: inserted });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A translation with this key already exists in this language'
      );
    }
  }
);

export const getTranslationRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit TranslationResponse @field(.translation, Translation)',
      true
    ),
    description:
      'Fetch a single navigator translation entry by language and key',
    parameters: [...translationParams],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(translationResponseSchema),
          },
        },
        description: 'Translation found',
      },
      404: { description: 'Translation not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', translationParamsSchema),
  async (c) => {
    const { lang, key } = c.req.valid('param');

    const [translation] = await db
      .select()
      .from(navigatorTranslation)
      .where(
        and(
          eq(navigatorTranslation.langKey, lang),
          eq(navigatorTranslation.textKey, key)
        )
      );

    if (!translation) {
      throw notFound('Translation not found');
    }

    return ok(c, { translation });
  }
);

export const updateTranslationRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit TranslationResponse @field(.translation, Translation)',
      true
    ),
    description: 'Update the text of a navigator translation entry',
    parameters: [...translationParams],
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
        description: 'Translation updated',
      },
      404: { description: 'Translation not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateTranslationSchema),
  zValidator('param', translationParamsSchema),
  async (c) => {
    const { lang, key } = c.req.valid('param');
    const payload = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(navigatorTranslation)
      .where(
        and(
          eq(navigatorTranslation.langKey, lang),
          eq(navigatorTranslation.textKey, key)
        )
      );

    if (!existing) {
      throw notFound('Translation not found');
    }

    const set = pickDefined(payload);
    if (Object.keys(set).length === 0) {
      return ok(c, { translation: existing });
    }

    const [updated] = await db
      .update(navigatorTranslation)
      .set(set)
      .where(
        and(
          eq(navigatorTranslation.langKey, lang),
          eq(navigatorTranslation.textKey, key)
        )
      )
      .returning();

    if (!updated) {
      throw notFound('Translation not found');
    }

    return ok(c, { translation: updated });
  }
);

export const deleteTranslationRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@nodata', true),
    description: 'Delete a navigator translation entry',
    parameters: [...translationParams],
    responses: {
      200: { description: 'Translation deleted' },
      404: { description: 'Translation not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', translationParamsSchema),
  async (c) => {
    const { lang, key } = c.req.valid('param');

    const [deleted] = await db
      .delete(navigatorTranslation)
      .where(
        and(
          eq(navigatorTranslation.langKey, lang),
          eq(navigatorTranslation.textKey, key)
        )
      )
      .returning();

    if (!deleted) {
      throw notFound('Translation not found');
    }

    return ok(c, undefined);
  }
);
