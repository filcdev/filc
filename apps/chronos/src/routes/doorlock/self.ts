import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { and, eq } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { auditLog, card } from '#database/schema/doorlock';
import { requireAuthentication } from '#middleware/auth';
import { cardWithRelationsSchema } from '#routes/doorlock/cards';
import { sendMessage } from '#routes/doorlock/websocket-handler';
import {
  type DoorlockCardWithRelations,
  fetchCardById,
  fetchCards,
} from '#utils/doorlock/cards';
import { syncDevicesByIds } from '#utils/doorlock/device-sync';
import { ensureJsonSafeDates } from '#utils/zod';
import { doorlockFactory } from './_factory';

const logger = getLogger(['chronos', 'doorlock', 'self']);

const auditLogSelectSchema = createSelectSchema(auditLog);

const cardsResponseSchema = z.object({
  data: z.object({
    cards: z.array(cardWithRelationsSchema),
  }),
  success: z.literal(true),
});

const updateFrozenSchema = z.object({
  frozen: z.boolean(),
});

const { schema: updateFrozenRequestSchema } =
  await resolver(updateFrozenSchema).toOpenAPISchema();

const cardResponseSchema = z.object({
  data: z.object({
    card: cardWithRelationsSchema,
  }),
  success: z.literal(true),
});

const activateVirtualCardSchema = z.object({
  deviceId: z.uuid().optional(),
});

const { schema: activateVirtualCardRequestSchema } = await resolver(
  activateVirtualCardSchema
).toOpenAPISchema();

const activationResponseSchema = z.object({
  data: z.object({
    log: auditLogSelectSchema,
  }),
  success: z.literal(true),
});

export const listSelfCardsRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'List cards owned by the authenticated user',
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
  async (c) => {
    const session = c.var.session;
    if (!session) {
      throw new HTTPException(StatusCodes.UNAUTHORIZED);
    }

    const cards = await fetchCards(eq(card.userId, session.userId));

    return c.json<SuccessResponse<{ cards: DoorlockCardWithRelations[] }>>({
      data: { cards },
      success: true,
    });
  }
);

export const updateSelfCardFrozenRoute = doorlockFactory.createHandlers(
  describeRoute({
    description: 'Update the frozen state of a user-owned card',
    requestBody: {
      content: {
        'application/json': {
          schema: updateFrozenRequestSchema,
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
      403: { description: 'Forbidden' },
      404: { description: 'Card not found' },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  zValidator('json', updateFrozenSchema),
  zValidator('param', z.object({ id: z.uuid() })),
  async (c) => {
    const session = c.var.session;
    const { id: cardId } = c.req.valid('param');
    const payload = c.req.valid('json');

    const [updated] = await db
      .update(card)
      .set({ frozen: payload.frozen })
      .where(and(eq(card.id, cardId), eq(card.userId, session.userId)))
      .returning({ id: card.id });

    if (!updated) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Card not found',
      });
    }

    const updatedCard = await fetchCardById(cardId);

    if (!updatedCard || updatedCard.userId !== session.userId) {
      logger.warn('Unexpected card fetch after self-update', {
        cardId,
        userId: session.userId,
      });
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Card not found',
      });
    }

    await syncDevicesByIds(
      updatedCard.authorizedDevices.map((device) => device.id)
    );

    return c.json<SuccessResponse<{ card: DoorlockCardWithRelations }>>({
      data: { card: updatedCard },
      success: true,
    });
  }
);

export const activateVirtualCardRoute = doorlockFactory.createHandlers(
  describeRoute({
    description:
      'Activate an authorized device using a user-owned virtual card',
    requestBody: {
      content: {
        'application/json': {
          schema: activateVirtualCardRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(activationResponseSchema)),
          },
        },
        description: 'Door activation has been triggered',
      },
      400: { description: 'Missing required parameters' },
      403: { description: 'Forbidden' },
      404: { description: 'Card not found' },
      409: { description: 'Card cannot be activated' },
    },
    tags: ['Doorlock'],
  }),
  requireAuthentication,
  zValidator('json', activateVirtualCardSchema),
  zValidator('param', z.object({ id: z.uuid() })),
  async (c) => {
    const session = c.var.session;
    const { id: cardId } = c.req.valid('param');
    const payload = c.req.valid('json');

    const cardRecord = await fetchCardById(cardId);
    if (!cardRecord || cardRecord.userId !== session.userId) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Card not found',
      });
    }

    if (!cardRecord.enabled || cardRecord.frozen) {
      throw new HTTPException(StatusCodes.CONFLICT, {
        message: 'Card is currently inactive',
      });
    }

    if (!cardRecord.authorizedDevices.length) {
      throw new HTTPException(StatusCodes.CONFLICT, {
        message: 'Card is not authorized on any devices',
      });
    }

    const resolveTargetDevice = () => {
      if (payload.deviceId) {
        const matched = cardRecord.authorizedDevices.find(
          (device) => device.id === payload.deviceId
        );
        if (!matched) {
          throw new HTTPException(StatusCodes.FORBIDDEN, {
            message: 'Card cannot control the requested device',
          });
        }
        return matched;
      }

      if (cardRecord.authorizedDevices.length > 1) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: 'deviceId is required for cards linked to multiple devices',
        });
      }

      return cardRecord.authorizedDevices[0];
    };

    const targetDevice = resolveTargetDevice();

    if (!targetDevice) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Target device not found',
      });
    }

    try {
      sendMessage(
        {
          name:
            cardRecord.owner?.nickname ??
            cardRecord.owner?.name ??
            cardRecord.name,
          type: 'open-door',
        },
        targetDevice.id
      );

      const [logEntry] = await db
        .insert(auditLog)
        .values({
          buttonPressed: true,
          cardData: cardRecord.cardData,
          cardId: cardRecord.id,
          deviceId: targetDevice.id,
          result: true,
          userId: session.userId,
        })
        .returning();

      return c.json<SuccessResponse<{ log: typeof logEntry }>>({
        data: { log: logEntry },
        success: true,
      });
    } catch (error) {
      logger.error('Failed to activate virtual card', {
        cardId,
        deviceId: targetDevice.id,
        error,
      });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to activate virtual card',
      });
    }
  }
);
