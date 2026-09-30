import { getLogger } from '@logtape/logtape';
import { ORPCError } from '@orpc/server';
import { and, eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthentication } from '#middleware/auth';
import { sendMessage } from '#modules/doorlock/device-socket';
import { auditLog, card } from '#modules/doorlock/schema';
import { fetchCardById, fetchCards } from '#modules/doorlock/utils/cards';
import { syncDevicesByIds } from '#modules/doorlock/utils/device-sync';
import { base } from '#orpc';
import { badRequest, conflict, forbidden, notFound } from '#utils/http';

const logger = getLogger(['chronos', 'doorlock', 'self']);

export const listSelfCards = base.doorlock.self.cards.list
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const cards = await fetchCards(eq(card.userId, context.session.userId));

    return { cards };
  });

export const updateSelfCardFrozen = base.doorlock.self.cards.setFrozen
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const { id: cardId, frozen } = input;

    const [updated] = await db
      .update(card)
      .set({ frozen })
      .where(and(eq(card.id, cardId), eq(card.userId, context.session.userId)))
      .returning({ id: card.id });

    if (!updated) {
      throw notFound('Card not found');
    }

    const updatedCard = await fetchCardById(cardId);

    if (!updatedCard || updatedCard.userId !== context.session.userId) {
      logger.warn('Unexpected card fetch after self-update', {
        cardId,
        userId: context.session.userId,
      });
      throw notFound('Card not found');
    }

    await syncDevicesByIds(
      updatedCard.authorizedDevices.map(
        (authorizedDevice) => authorizedDevice.id
      )
    );

    return { card: updatedCard };
  });

export const activateVirtualCard = base.doorlock.self.cards.activate
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const { deviceId, id: cardId } = input;

    const cardRecord = await fetchCardById(cardId);
    if (!cardRecord || cardRecord.userId !== context.session.userId) {
      throw notFound('Card not found');
    }

    if (!cardRecord.enabled || cardRecord.frozen) {
      throw conflict('Card is currently inactive');
    }

    if (!cardRecord.authorizedDevices.length) {
      throw conflict('Card is not authorized on any devices');
    }

    const resolveTargetDevice = () => {
      if (deviceId) {
        const matched = cardRecord.authorizedDevices.find(
          (authorizedDevice) => authorizedDevice.id === deviceId
        );
        if (!matched) {
          throw forbidden('Card cannot control the requested device');
        }
        return matched;
      }

      if (cardRecord.authorizedDevices.length > 1) {
        throw badRequest(
          'deviceId is required for cards linked to multiple devices'
        );
      }

      return cardRecord.authorizedDevices[0];
    };

    const targetDevice = resolveTargetDevice();

    if (!targetDevice) {
      throw notFound('Target device not found');
    }

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
        userId: context.session.userId,
      })
      .returning();

    if (!logEntry) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to record the door activation',
      });
    }

    return { log: logEntry };
  });
