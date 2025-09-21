import { Hono } from 'hono';
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
