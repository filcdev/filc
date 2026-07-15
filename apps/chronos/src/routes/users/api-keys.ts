import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { and, desc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { apiKey } from '#database/schema/api-keys';
import { requireAuthentication } from '#middleware/auth';
import { generateApiKey } from '#utils/api-keys';
import { filcExt } from '#utils/openapi';
import { createSelectSchema } from '#utils/zod';
import { usersFactory } from './_factory';

const logger = getLogger(['chronos', 'users', 'api-keys']);

// Never leak the hash or the raw key in listings.
const apiKeySelectSchema = createSelectSchema(apiKey).omit({
  keyHash: true,
});

const createApiKeySchema = z.object({
  expiresAt: z.coerce.date().optional(),
  name: z.string().min(1, 'Name is required').max(64),
});

const { schema: createApiKeyRequestSchema } =
  await resolver(createApiKeySchema).toOpenAPISchema();

const listApiKeysResponseSchema = z.object({
  data: z.object({
    apiKeys: z.array(apiKeySelectSchema),
  }),
  success: z.literal(true),
});

const createApiKeyResponseSchema = z.object({
  data: z.object({
    apiKey: apiKeySelectSchema,
    // The raw secret is only returned here, at creation time.
    rawKey: z.string(),
  }),
  success: z.literal(true),
});

export const listApiKeysRoute = usersFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Users',
      '@unit ApiKeyListResponse @field(.apiKeys, List<ApiKey>)',
      true
    ),
    description: 'List the API keys belonging to the authenticated user',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(listApiKeysResponseSchema),
          },
        },
        description: 'Successful response',
      },
    },
    tags: ['Users'],
  }),
  requireAuthentication,
  async (c) => {
    const session = c.var.session;
    if (!session) {
      throw new HTTPException(StatusCodes.UNAUTHORIZED);
    }

    const keys = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.userId, session.userId))
      .orderBy(desc(apiKey.createdAt));

    return c.json<SuccessResponse<{ apiKeys: typeof keys }>>({
      data: { apiKeys: keys },
      success: true,
    });
  }
);

export const createApiKeyRoute = usersFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Users',
      '@unit ApiKeyResponse @field(.apiKey, ApiKey) @field(.rawKey, String)',
      true
    ),
    description:
      'Create a new API key for the authenticated user. The raw key is only returned in this response.',
    requestBody: {
      content: {
        'application/json': {
          schema: createApiKeyRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(createApiKeyResponseSchema),
          },
        },
        description: 'API key created',
      },
    },
    tags: ['Users'],
  }),
  requireAuthentication,
  zValidator('json', createApiKeySchema),
  async (c) => {
    const session = c.var.session;
    if (!session) {
      throw new HTTPException(StatusCodes.UNAUTHORIZED);
    }

    const { name, expiresAt } = c.req.valid('json');
    const { hash, key, prefix } = generateApiKey();

    const [inserted] = await db
      .insert(apiKey)
      .values({
        expiresAt: expiresAt ?? null,
        keyHash: hash,
        name,
        prefix,
        userId: session.userId,
      })
      .returning();

    if (!inserted) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to create API key',
      });
    }

    logger.info('Created API key', {
      id: inserted.id,
      userId: session.userId,
    });

    return c.json<SuccessResponse<{ apiKey: typeof inserted; rawKey: string }>>(
      {
        data: { apiKey: inserted, rawKey: key },
        success: true,
      },
      StatusCodes.CREATED
    );
  }
);

export const revokeApiKeyRoute = usersFactory.createHandlers(
  describeRoute({
    ...filcExt('Users', '@nodata', true),
    description: 'Revoke (delete) an API key owned by the authenticated user',
    responses: {
      200: { description: 'API key revoked' },
      404: { description: 'API key not found' },
    },
    tags: ['Users'],
  }),
  requireAuthentication,
  zValidator('param', z.object({ id: z.uuid() })),
  async (c) => {
    const session = c.var.session;
    if (!session) {
      throw new HTTPException(StatusCodes.UNAUTHORIZED);
    }

    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(apiKey)
      .where(and(eq(apiKey.id, id), eq(apiKey.userId, session.userId)))
      .returning();

    if (!deleted) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'API key not found',
      });
    }

    logger.info('Revoked API key', { id, userId: session.userId });

    return c.json<SuccessResponse>({ success: true });
  }
);
