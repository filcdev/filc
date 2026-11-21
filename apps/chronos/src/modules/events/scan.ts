import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { and, asc, eq, gt, gte } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthentication } from '#middleware/auth';
import { event, eventCheckinGrant } from '#modules/events/schema';
import { base } from '#orpc';
import { userHasPermission } from '#utils/authorization';
import { forbidden } from '#utils/http';

const logger = getLogger(['chronos', 'events', 'scan']);

/**
 * The scanner's event picker.
 *
 * A global `events:checkin` holder gets every published event still ahead —
 * the same rows the public list shows. Everyone else gets exactly the events
 * their own door grant covers, which is the whole point: an approved helper
 * scans one event, not the school's calendar.
 *
 * The 403 for a caller with neither is deliberate: it is the difference
 * between "you may not scan" (the app's no-access screen) and "there is
 * nothing to scan right now" (an empty picker).
 */
export const listScanEvents = base.events.scan
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const userId = context.session.userId;
    const now = new Date();
    const global = await userHasPermission(userId, permissions.eventsCheckin);

    if (global) {
      const rows = await db
        .select({
          endsAt: event.endsAt,
          id: event.id,
          startsAt: event.startsAt,
          title: event.title,
        })
        .from(event)
        .where(and(eq(event.status, 'published'), gte(event.endsAt, now)))
        .orderBy(asc(event.startsAt));

      logger.debug('scan event list read with the global permission', {
        requestId: context.requestId,
        returned: rows.length,
        userId,
      });

      return {
        items: rows.map((row) => ({ ...row, expiresAt: null })),
        total: rows.length,
      };
    }

    const rows = await db
      .select({
        endsAt: event.endsAt,
        expiresAt: eventCheckinGrant.expiresAt,
        id: event.id,
        startsAt: event.startsAt,
        title: event.title,
      })
      .from(eventCheckinGrant)
      .innerJoin(event, eq(eventCheckinGrant.eventId, event.id))
      .where(
        and(
          eq(eventCheckinGrant.userId, userId),
          gt(eventCheckinGrant.expiresAt, now)
        )
      )
      .orderBy(asc(event.startsAt));

    if (rows.length === 0) {
      logger.info('scan event list refused: no permission and no grant', {
        requestId: context.requestId,
        userId,
      });
      throw forbidden('You cannot check in for any event');
    }

    logger.debug('scan event list read from door grants', {
      requestId: context.requestId,
      returned: rows.length,
      userId,
    });

    return { items: rows, total: rows.length };
  });
