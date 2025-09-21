import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { openDoorLock } from '~/mqtt/client';
import { userHasPermission } from '~/utils/authorization';
import type { SuccessResponse } from '~/utils/globals';
import { requireAuthentication } from '~/utils/middleware';
import { doorlockFactory } from './_factory';

export const openDoor = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const deviceId = c.req.param('deviceId');

    if (!(await userHasPermission(c.var.user.id, `door:${deviceId}:open`))) {
      throw new HTTPException(StatusCodes.FORBIDDEN, { message: 'Forbidden' });
    }

    if (!deviceId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing deviceId',
      });
    }

    openDoorLock(deviceId, 'Opened via API');

    return c.json<SuccessResponse>({
      success: true,
      data: { status: 'queued', deviceId },
    });
  }
);
