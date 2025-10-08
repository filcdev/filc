import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { isFeatureEnabled } from '~/utils/feature-flag';
import type { Context } from '~/utils/globals';
import {
  createCard,
  deleteCard,
  getCard,
  listCards,
  updateCard,
} from './cards';
import {
  deleteDevice,
  getDevice,
  getDeviceStatus,
  listDeviceCards,
  listDevices,
  replaceDeviceCards,
  upsertDevice,
} from './devices';
import { openDoor } from './open';

export const doorlockRouter = new Hono<Context>()
  .use('*', async (_c, next) => {
    // Check feature flag on every request
    const enabled = await isFeatureEnabled('doorlock:api');
    if (!enabled) {
      throw new HTTPException(StatusCodes.SERVICE_UNAVAILABLE, {
        message: 'Doorlock API is currently disabled',
      });
    }
    await next();
  })
  .get('/cards', ...listCards)
  .get('/cards/:id', ...getCard)
  .post('/cards', ...createCard)
  .patch('/cards/:id', ...updateCard)
  .delete('/cards/:id', ...deleteCard)
  .post('/:deviceId/open', ...openDoor)
  // Device management
  .get('/devices', ...listDevices)
  .get('/devices/:id', ...getDevice)
  .put('/devices/:id', ...upsertDevice) // idempotent create/update
  .delete('/devices/:id', ...deleteDevice)
  .get('/devices/:id/cards', ...listDeviceCards)
  .put('/devices/:id/cards', ...replaceDeviceCards) // replace restrictions
  .get('/devices/:id/status', ...getDeviceStatus);
