import { getLogger } from '@logtape/logtape';
import { and, eq, lte } from 'drizzle-orm';
import type { db as Db } from '#database';
import { db } from '#database';
import { eventCheckinGrant } from '#modules/events/schema';

const logger = getLogger(['chronos', 'events', 'grant']);

/** How long a helper keeps the door open after the event ends. */
export const CHECKIN_GRANT_LIFETIME_MS = 24 * 60 * 60 * 1000;

export type GrantTransaction =
  | typeof Db
  | Parameters<Parameters<(typeof Db)['transaction']>[0]>[0];

/** When an event's helpers may stop scanning: the end plus one day. */
export const checkinGrantExpiresAt = (endsAt: Date): Date =>
  new Date(endsAt.getTime() + CHECKIN_GRANT_LIFETIME_MS);

/**
 * Creates a helper's grant, or refreshes its expiry when they are approved
 * again. The unique `(user_id, event_id)` pair makes this an upsert rather
 * than a second row.
 */
export const upsertCheckinGrant = async (
  tx: GrantTransaction,
  args: { eventId: string; expiresAt: Date; userId: string }
): Promise<void> => {
  await tx
    .insert(eventCheckinGrant)
    .values({
      eventId: args.eventId,
      expiresAt: args.expiresAt,
      userId: args.userId,
    })
    .onConflictDoUpdate({
      set: { expiresAt: args.expiresAt },
      target: [eventCheckinGrant.userId, eventCheckinGrant.eventId],
    });
};

/** Removes a helper's grant: a decline, a withdrawal or an early revoke. */
export const revokeCheckinGrant = async (
  tx: GrantTransaction,
  args: { eventId: string; userId: string }
): Promise<void> => {
  await tx
    .delete(eventCheckinGrant)
    .where(
      and(
        eq(eventCheckinGrant.eventId, args.eventId),
        eq(eventCheckinGrant.userId, args.userId)
      )
    );
};

/**
 * Drops rows that have already lapsed. This is housekeeping, not access
 * control: every check reads `expires_at` against the request clock, so an
 * expired grant is refused whether or not this job has run.
 */
export const cleanUpExpiredCheckinGrants = async (): Promise<void> => {
  const removed = await db
    .delete(eventCheckinGrant)
    .where(lte(eventCheckinGrant.expiresAt, new Date()))
    .returning({ id: eventCheckinGrant.id });

  if (removed.length > 0) {
    logger.info('expired event check-in grants removed', {
      count: removed.length,
    });
  } else {
    logger.debug('no expired event check-in grants to remove');
  }
};
