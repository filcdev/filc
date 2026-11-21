import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { requireAuthorization } from '#middleware/auth';
import { readEventStats } from '#modules/events/utils/stats';
import { base } from '#orpc';

const logger = getLogger(['chronos', 'events', 'stats']);

/** The organizer's plain numbers for one event; all of it is plain counts. */
export const getEventStats = base.events.stats
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const stats = await readEventStats(input.id);

    logger.debug('event stats read', {
      eventId: input.id,
      requestId: context.requestId,
      taken: stats.seats.taken,
    });

    return stats;
  });
