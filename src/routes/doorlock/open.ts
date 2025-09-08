import { StatusCodes } from 'http-status-codes';
import { openDoorLock } from '~/mqtt/client';
import { userHasPermission } from '~/utils/authorization';
import { requireAuthentication } from '~/utils/middleware';
import { doorlockFactory } from './_factory';

export const openDoor = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const deviceId = c.req.param('deviceId');

    if (!(await userHasPermission(c.var.user.id, `door:${deviceId}:open`))) {
      return c.json({ error: 'Forbidden' }, StatusCodes.FORBIDDEN);
    }

    if (!deviceId) {
      return c.json({ error: 'Missing deviceId' }, StatusCodes.BAD_REQUEST);
    }

    openDoorLock(deviceId, 'Opened via API');

    return c.json({ status: 'queued', deviceId }, StatusCodes.ACCEPTED);
  }
);
