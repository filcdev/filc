import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '#database';
import { eventCheckinGrant } from '#modules/events/schema';
import { rbac, userHasPermission } from '#utils/authorization';
import { forbidden } from '#utils/http';

const logger = getLogger(['chronos', 'events', 'checkin', 'access']);

/**
 * The door no longer requires the global permission, but the permission is
 * still a real one an organizer may hold — and the roles UI lists what has
 * been registered. Registering it here keeps it in that list now that no route
 * middleware registers it by requiring it.
 */
rbac.registerPermission(permissions.eventsCheckin);

/**
 * Whether this caller may scan at this event: the global `events:checkin`
 * permission, or a grant for this exact event that has not lapsed. The clock
 * is read on every request, so an expired grant is refused even before the
 * cleanup job has seen it.
 */
export const hasEventCheckinAccess = async (
  userId: string,
  eventId: string,
  now: Date = new Date()
): Promise<boolean> => {
  if (await userHasPermission(userId, permissions.eventsCheckin)) {
    return true;
  }

  const [grant] = await db
    .select({ id: eventCheckinGrant.id })
    .from(eventCheckinGrant)
    .where(
      and(
        eq(eventCheckinGrant.userId, userId),
        eq(eventCheckinGrant.eventId, eventId),
        gt(eventCheckinGrant.expiresAt, now)
      )
    )
    .limit(1);

  return Boolean(grant);
};

/**
 * The handler-level guard the check-in route calls before touching a ticket.
 * A helper's grant is per event, on purpose: approving one registration must
 * never hand someone the door of every other event.
 */
export const requireEventCheckin = async (
  userId: string,
  eventId: string,
  now: Date = new Date()
): Promise<void> => {
  if (await hasEventCheckinAccess(userId, eventId, now)) {
    return;
  }

  logger.info('check-in refused: no permission or grant for this event', {
    eventId,
    userId,
  });
  throw forbidden('You cannot check in for this event');
};
