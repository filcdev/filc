import type { EventRoomSummary } from '@filcdev/api/domains/events/room';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import type { db as Db } from '#database';
import { db } from '#database';
import { eventRegistration, eventRoom } from '#modules/events/schema';
import { SEAT_ROLES } from '#modules/events/utils/seats';
import { roomNotFound } from '#utils/http';

type TxOrDb =
  | typeof db
  | Parameters<Parameters<(typeof Db)['transaction']>[0]>[0];

/**
 * The event's rooms in the organizer's order. `position` is the intended order
 * and the id breaks a duplicate position, exactly like the signup questions.
 */
export const eventRooms = async (eventId: string, tx?: TxOrDb) =>
  (tx ?? db)
    .select()
    .from(eventRoom)
    .where(eq(eventRoom.eventId, eventId))
    .orderBy(asc(eventRoom.position), asc(eventRoom.id));

/**
 * The event's rooms plus the one a registration named. A supplied room of
 * another event — or of no event at all — is a 404, never a silent ignore;
 * a missing id simply selects nothing, and the rules decide whether the event
 * requires one.
 */
export const resolveChosenRoom = async (
  eventId: string,
  roomId: string | undefined,
  tx?: TxOrDb
) => {
  const rooms = await eventRooms(eventId, tx);
  if (!roomId) {
    return { chosenRoom: null, rooms };
  }

  const chosenRoom = rooms.find((room) => room.id === roomId) ?? null;
  if (!chosenRoom) {
    throw roomNotFound('Room not found');
  }
  return { chosenRoom, rooms };
};

/**
 * How many seats of one room are taken. Only confirmed rows that occupy a seat
 * count, so a cancellation frees the place and a helper never fills one.
 */
export const roomSeatCount = async (
  roomId: string,
  tx?: TxOrDb
): Promise<number> => {
  const [row] = await (tx ?? db)
    .select({ value: count() })
    .from(eventRegistration)
    .where(
      and(
        eq(eventRegistration.roomId, roomId),
        eq(eventRegistration.status, 'confirmed'),
        inArray(eventRegistration.role, SEAT_ROLES)
      )
    );
  return Number(row?.value ?? 0);
};

/**
 * The event's rooms with their remaining places, in one read for the whole
 * list: the room rows plus one grouped count. Used by the public detail, which
 * needs the choice and every room's free places in the same response.
 */
export const eventRoomSummaries = async (
  eventId: string,
  tx?: TxOrDb
): Promise<EventRoomSummary[]> => {
  const rooms = await eventRooms(eventId, tx);
  if (rooms.length === 0) {
    return [];
  }

  const counts = await (tx ?? db)
    .select({ roomId: eventRegistration.roomId, value: count() })
    .from(eventRegistration)
    .where(
      and(
        inArray(
          eventRegistration.roomId,
          rooms.map((room) => room.id)
        ),
        eq(eventRegistration.status, 'confirmed'),
        inArray(eventRegistration.role, SEAT_ROLES)
      )
    )
    .groupBy(eventRegistration.roomId);
  const taken = new Map(counts.map((row) => [row.roomId, Number(row.value)]));

  return rooms.map((room) => {
    const seatsTaken = taken.get(room.id) ?? 0;
    return {
      capacity: room.capacity,
      id: room.id,
      name: room.name,
      remaining: Math.max(room.capacity - seatsTaken, 0),
    };
  });
};
