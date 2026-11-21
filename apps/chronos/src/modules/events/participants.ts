import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { requireAuthorization } from '#middleware/auth';
import {
  listEventRegistrations,
  requireEvent,
} from '#modules/events/utils/participants';
import { base } from '#orpc';

const logger = getLogger(['chronos', 'events', 'participants']);

/** The organizer's participant list: one page, filtered, newest first. */
export const listRegistrations = base.events.registrations.list
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    await requireEvent(input.id);

    const result = await listEventRegistrations(input);

    logger.debug('participant list read', {
      eventId: input.id,
      limit: input.limit,
      offset: input.offset,
      requestId: context.requestId,
      returned: result.items.length,
      role: input.role,
      search: Boolean(input.search),
      status: input.status,
      total: result.total,
    });

    return result;
  });
