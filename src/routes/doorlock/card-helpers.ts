import type { SQL } from 'drizzle-orm';
import { desc, eq } from 'drizzle-orm';
import { db } from '~/database';
import { user } from '~/database/schema/authentication';
import { card, cardDevice, device } from '~/database/schema/doorlock';

type CardRecord = typeof card.$inferSelect;
type DeviceSummary = Pick<typeof device.$inferSelect, 'id' | 'name'>;
type OwnerSummary = Pick<
  typeof user.$inferSelect,
  'id' | 'name' | 'email' | 'nickname'
>;

export type DoorlockCardWithRelations = CardRecord & {
  authorizedDevices: DeviceSummary[];
  owner: OwnerSummary | null;
};

export type CardRow = {
  cardCreatedAt: Date;
  cardData: string;
  cardEnabled: boolean;
  cardFrozen: boolean;
  cardId: string;
  cardName: string;
  cardUpdatedAt: Date;
  cardUserId: string;
  deviceId: string | null;
  deviceName: string | null;
  ownerEmail: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerNickname: string | null;
};

const sanitizeDeviceIds = (ids: string[]) => Array.from(new Set(ids));

export const cardRowSelection = {
  cardCreatedAt: card.createdAt,
  cardData: card.cardData,
  cardEnabled: card.enabled,
  cardFrozen: card.frozen,
  cardId: card.id,
  cardName: card.name,
  cardUpdatedAt: card.updatedAt,
  cardUserId: card.userId,
  deviceId: device.id,
  deviceName: device.name,
  ownerEmail: user.email,
  ownerId: user.id,
  ownerName: user.name,
  ownerNickname: user.nickname,
};

const buildCardRecord = (row: CardRow): DoorlockCardWithRelations => ({
  authorizedDevices: [],
  cardData: row.cardData,
  createdAt: row.cardCreatedAt,
  enabled: row.cardEnabled,
  frozen: row.cardFrozen,
  id: row.cardId,
  name: row.cardName,
  owner: row.ownerId
    ? {
        email: row.ownerEmail ?? 'Unknown email',
        id: row.ownerId,
        name: row.ownerName ?? 'Unknown user',
        nickname: row.ownerNickname,
      }
    : null,
  updatedAt: row.cardUpdatedAt,
  userId: row.cardUserId,
});

const appendDeviceToCard = (
  cardRecord: DoorlockCardWithRelations,
  row: CardRow
) => {
  if (!row.deviceId) {
    return;
  }
  const alreadyAdded = cardRecord.authorizedDevices.some(
    (authorizedDevice) => authorizedDevice.id === row.deviceId
  );
  if (!alreadyAdded) {
    cardRecord.authorizedDevices.push({
      id: row.deviceId,
      name: row.deviceName ?? 'Unknown device',
    });
  }
};

export function mapRowsToCards(rows: CardRow[]): DoorlockCardWithRelations[] {
  const map = new Map<string, DoorlockCardWithRelations>();

  for (const row of rows) {
    if (!map.has(row.cardId)) {
      map.set(row.cardId, buildCardRecord(row));
    }

    const existing = map.get(row.cardId);
    if (!existing) {
      continue;
    }
    appendDeviceToCard(existing, row);
  }

  return Array.from(map.values());
}

export async function fetchCards(
  whereClause?: SQL<unknown>
): Promise<DoorlockCardWithRelations[]> {
  const rows = await db
    .select(cardRowSelection)
    .from(card)
    .leftJoin(cardDevice, eq(cardDevice.cardId, card.id))
    .leftJoin(device, eq(cardDevice.deviceId, device.id))
    .leftJoin(user, eq(card.userId, user.id))
    .where(whereClause)
    .orderBy(desc(card.updatedAt));

  return mapRowsToCards(rows);
}

export async function fetchCardById(
  cardId: string
): Promise<DoorlockCardWithRelations | undefined> {
  const [single] = await fetchCards(eq(card.id, cardId));
  return single;
}

type CardDbExecutor = Pick<typeof db, 'delete' | 'insert'>;

export async function replaceCardDevices(
  tx: CardDbExecutor,
  cardId: string,
  deviceIds: string[]
) {
  await tx.delete(cardDevice).where(eq(cardDevice.cardId, cardId));

  const sanitized = sanitizeDeviceIds(deviceIds);
  if (!sanitized.length) {
    return;
  }

  await tx.insert(cardDevice).values(
    sanitized.map((deviceId) => ({
      cardId,
      deviceId,
    }))
  );
}
