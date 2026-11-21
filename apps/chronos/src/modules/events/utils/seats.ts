import type { EventSeats } from '@filcdev/api/domains/events/event';
import { and, count, eq, inArray } from 'drizzle-orm';
import type { db as Db } from '#database';
import { db } from '#database';
import { eventRegistration } from '#modules/events/schema';

type TxOrDb =
  | typeof db
  | Parameters<Parameters<(typeof Db)['transaction']>[0]>[0];

/** `remaining` is null for an unlimited event, and never negative. */
export const toSeats = (
  capacity: number | null,
  taken: number
): EventSeats => ({
  capacity,
  remaining: capacity === null ? null : Math.max(capacity - taken, 0),
  taken,
});

/** Roles that occupy a seat. A visitor (a guest) does; a helper does not. */
const SEAT_ROLES = ['participant', 'visitor'] as const;

/** The confirmed seats of one event; a helper never fills one. */
export const seatCount = async (
  eventId: string,
  tx?: TxOrDb
): Promise<number> => {
  const [row] = await (tx ?? db)
    .select({ value: count() })
    .from(eventRegistration)
    .where(
      and(
        eq(eventRegistration.eventId, eventId),
        eq(eventRegistration.status, 'confirmed'),
        inArray(eventRegistration.role, SEAT_ROLES)
      )
    );
  return Number(row?.value ?? 0);
};

/** The same count for a page of events, in one query instead of one each. */
export const seatCounts = async (
  eventIds: readonly string[]
): Promise<Map<string, number>> => {
  if (eventIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({ eventId: eventRegistration.eventId, value: count() })
    .from(eventRegistration)
    .where(
      and(
        inArray(eventRegistration.eventId, [...eventIds]),
        eq(eventRegistration.status, 'confirmed'),
        inArray(eventRegistration.role, SEAT_ROLES)
      )
    )
    .groupBy(eventRegistration.eventId);
  return new Map(rows.map((row) => [row.eventId, Number(row.value)]));
};
