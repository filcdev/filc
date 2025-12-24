import { getLogger } from '@logtape/logtape';
import { eq, sql } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { card, device } from '#database/schema/doorlock';
import {
  type DoorlockCardWithRelations,
  fetchCardById,
  fetchCards,
  migrateAuditLogsForNewCard,
  replaceCardDevices,
} from '#routes/doorlock/card-helpers';
import { syncDevicesByIds } from '#routes/doorlock/device-sync';
import type { SuccessResponse } from '#utils/globals';
import { requireAuthentication, requireAuthorization } from '#utils/middleware';
import { ensureJsonSafeDates } from '#utils/zod';
import { doorlockFactory } from './_factory';

const logger = getLogger(['chronos', 'doorlock', 'cards']);

type DoorlockUserSummary = Pick<
  typeof user.$inferSelect,
  'id' | 'name' | 'email' | 'nickname'
>;

const cardSelectSchema = createSelectSchema(card);
const deviceSummarySchema = createSelectSchema(device).pick({
  id: true,
  name: true,
});
const userSummarySchema = z.object({
  email: z.string().nullable(),
  id: z.uuid(),
  name: z.string().nullable(),
  nickname: z.string().nullable(),
});

export const cardWithRelationsSchema = cardSelectSchema.extend({
  authorizedDevices: z.array(deviceSummarySchema),
  owner: userSummarySchema.nullable().optional(),
});

const cardsResponseSchema = z.object({
  data: z.object({
    cards: z.array(cardWithRelationsSchema),
  }),
  success: z.literal(true),
});

const cardResponseSchema = z.object({
  data: z.object({
    card: cardWithRelationsSchema,
  }),
  success: z.literal(true),
});

const usersResponseSchema = z.object({
  data: z.object({
    users: z.array(userSummarySchema),
  }),
  success: z.literal(true),
});

const baseCardPayloadSchema = z.object({
  authorizedDeviceIds: z.array(z.uuid()).default([]),
  enabled: z.boolean().default(true),
  frozen: z.boolean().default(false),
  name: z.string().min(1, 'Card name is required'),
});

const createCardSchema = baseCardPayloadSchema.extend({
  cardData: z.string().min(1, 'Card UID is required'),
  userId: z.uuid('User is required'),
});

const updateCardSchema = baseCardPayloadSchema.extend({
  userId: z.uuid('User is required'),
});
const { schema: createCardRequestSchema } =
  await resolver(createCardSchema).toOpenAPISchema();
const { schema: updateCardRequestSchema } =
  await resolver(updateCardSchema).toOpenAPISchema();

const assertCardExists = (cardRecord?: DoorlockCardWithRelations | null) => {
  if (!cardRecord) {
    throw new HTTPException(StatusCodes.NOT_FOUND, {
      message: 'Card not found',
    });
  }
  return cardRecord;
};

export const listCardsRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'List all access cards',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(cardsResponseSchema)),
          },
        },
        description: 'Successful response',
      },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:cards:read'),
  async (c) => {
    const cards = await fetchCards();

    return c.json<SuccessResponse<{ cards: DoorlockCardWithRelations[] }>>({
      data: { cards },
      success: true,
    });
  }
);

export const listDoorlockUsersRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'List users eligible for card ownership',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(usersResponseSchema),
          },
        },
        description: 'Successful response',
      },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:cards:write'),
  async (c) => {
    const usersList = await db
      .select({
        email: user.email,
        id: user.id,
        name: user.name,
        nickname: user.nickname,
      })
      .from(user)
      .orderBy(sql`coalesce(${user.nickname}, ${user.name})`);

    return c.json<SuccessResponse<{ users: DoorlockUserSummary[] }>>({
      data: { users: usersList },
      success: true,
    });
  }
);

export const createCardRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Create a new access card',
    requestBody: {
      content: {
        'application/json': {
          schema: createCardRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(cardResponseSchema)),
          },
        },
        description: 'Card created',
      },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:cards:write'),
  async (c) => {
    const body = await c.req.json();
    const payload = createCardSchema.parse(body);

    try {
      const cardId = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(card)
          .values({
            cardData: payload.cardData,
            enabled: payload.enabled,
            frozen: payload.frozen,
            name: payload.name,
            userId: payload.userId,
          })
          .returning({ id: card.id });

        if (!created) {
          throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
            message: 'Failed to create card',
          });
        }

        await replaceCardDevices(tx, created.id, payload.authorizedDeviceIds);
        await migrateAuditLogsForNewCard(created.id, payload.cardData);
        return created.id;
      });

      const createdCard = assertCardExists(await fetchCardById(cardId));

      await syncDevicesByIds(
        createdCard.authorizedDevices.map(
          (authorizedDevice) => authorizedDevice.id
        )
      );

      return c.json<SuccessResponse<{ card: DoorlockCardWithRelations }>>(
        {
          data: { card: createdCard },
          success: true,
        },
        StatusCodes.CREATED
      );
    } catch (error) {
      logger.error('Failed to create card', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to create card',
      });
    }
  }
);

export const updateCardRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Update an access card',
    requestBody: {
      content: {
        'application/json': {
          schema: updateCardRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(cardResponseSchema)),
          },
        },
        description: 'Card updated',
      },
      404: { description: 'Card not found' },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:cards:write'),
  async (c) => {
    const cardId = c.req.param('id');
    if (!cardId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Card id is required',
      });
    }
    const body = await c.req.json();
    const payload = updateCardSchema.parse(body);

    try {
      await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(card)
          .set({
            enabled: payload.enabled,
            frozen: payload.frozen,
            name: payload.name,
            userId: payload.userId,
          })
          .where(eq(card.id, cardId))
          .returning({ id: card.id });

        if (!updated) {
          throw new HTTPException(StatusCodes.NOT_FOUND, {
            message: 'Card not found',
          });
        }

        await replaceCardDevices(tx, cardId, payload.authorizedDeviceIds);
      });

      const updatedCard = assertCardExists(await fetchCardById(cardId));

      await syncDevicesByIds(
        updatedCard.authorizedDevices.map(
          (authorizedDevice) => authorizedDevice.id
        )
      );

      return c.json<SuccessResponse<{ card: DoorlockCardWithRelations }>>({
        data: { card: updatedCard },
        success: true,
      });
    } catch (error) {
      logger.error('Failed to update card', { error });
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to update card',
      });
    }
  }
);

export const deleteCardRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Delete an access card',
    responses: {
      200: { description: 'Card deleted' },
      404: { description: 'Card not found' },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  requireAuthorization('doorlock:cards:write'),
  async (c) => {
    const cardId = c.req.param('id');
    if (!cardId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Card id is required',
      });
    }

    const existingCard = await fetchCardById(cardId);
    if (!existingCard) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Card not found',
      });
    }
    const [deleted] = await db
      .delete(card)
      .where(eq(card.id, cardId))
      .returning({ id: card.id });

    if (!deleted) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Card not found',
      });
    }

    await syncDevicesByIds(
      existingCard.authorizedDevices.map(
        (authorizedDevice) => authorizedDevice.id
      )
    );

    return c.json<SuccessResponse>({ success: true });
  }
);
