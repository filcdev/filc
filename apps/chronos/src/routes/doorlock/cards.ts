import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { card } from '#database/schema/doorlock';
import { requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import {
  type DoorlockCardWithRelations,
  fetchCardById,
  fetchCards,
  migrateAuditLogsForNewCard,
  replaceCardDevices,
} from '#utils/doorlock/cards';
import { syncDevicesByIds } from '#utils/doorlock/device-sync';
import { notFound } from '#utils/http';

const assertCardExists = (cardRecord?: DoorlockCardWithRelations | null) => {
  if (!cardRecord) {
    throw notFound('Card not found');
  }
  return cardRecord;
};

export const listCards = base.doorlock.cards.list
  .use(requireAuthorization(permissions.doorlockCardsRead))
  .handler(async () => {
    const cards = await fetchCards();

    return { cards };
  });

export const listDoorlockUsers = base.doorlock.cards.users
  .use(requireAuthorization(permissions.doorlockCardsWrite))
  .handler(async () => {
    const usersList = await db
      .select({
        email: user.email,
        id: user.id,
        name: user.name,
        nickname: user.nickname,
      })
      .from(user)
      .orderBy(sql`coalesce(${user.nickname}, ${user.name})`);

    return { users: usersList };
  });

export const createCard = base.doorlock.cards.create
  .use(requireAuthorization(permissions.doorlockCardsWrite))
  .handler(async ({ input: payload }) => {
    const cardId = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(card)
        .values({
          cardData: payload.cardData,
          enabled: payload.enabled,
          frozen: payload.frozen,
          name: payload.name,
          userId: payload.userId ?? null,
        })
        .returning({ id: card.id });

      if (!inserted) {
        throw new ORPCError('INTERNAL', {
          message: 'Failed to create card',
        });
      }

      await replaceCardDevices(tx, inserted.id, payload.authorizedDeviceIds);
      if (payload.userId) {
        await migrateAuditLogsForNewCard(
          tx,
          inserted.id,
          payload.userId,
          payload.cardData
        );
      }
      return inserted.id;
    });

    const createdCard = assertCardExists(await fetchCardById(cardId));

    await syncDevicesByIds(
      createdCard.authorizedDevices.map(
        (authorizedDevice) => authorizedDevice.id
      )
    );

    return { card: createdCard };
  });

export const updateCard = base.doorlock.cards.update
  .use(requireAuthorization(permissions.doorlockCardsWrite))
  .handler(async ({ input }) => {
    const { id: cardId, ...payload } = input;

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(card)
        .set({
          enabled: payload.enabled,
          frozen: payload.frozen,
          name: payload.name,
          userId: payload.userId ?? null,
        })
        .where(eq(card.id, cardId))
        .returning({ id: card.id });

      if (!updated) {
        throw notFound('Card not found');
      }

      await replaceCardDevices(tx, cardId, payload.authorizedDeviceIds);
    });

    const updatedCard = assertCardExists(await fetchCardById(cardId));

    await syncDevicesByIds(
      updatedCard.authorizedDevices.map(
        (authorizedDevice) => authorizedDevice.id
      )
    );

    return { card: updatedCard };
  });

export const deleteCard = base.doorlock.cards.delete
  .use(requireAuthorization(permissions.doorlockCardsWrite))
  .handler(async ({ input }) => {
    const cardId = input.id;

    const existingCard = await fetchCardById(cardId);
    if (!existingCard) {
      throw notFound('Card not found');
    }
    const [deleted] = await db
      .delete(card)
      .where(eq(card.id, cardId))
      .returning({ id: card.id });

    if (!deleted) {
      throw notFound('Card not found');
    }

    await syncDevicesByIds(
      existingCard.authorizedDevices.map(
        (authorizedDevice) => authorizedDevice.id
      )
    );

    return deleted;
  });
