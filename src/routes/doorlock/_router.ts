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

export const doorlockRouter = new Hono<Context>();

doorlockRouter.get('/cards', ...listCards);
doorlockRouter.get('/cards/:id', ...getCard);
doorlockRouter.post('/cards', ...createCard);
doorlockRouter.patch('/cards/:id', ...updateCard);
doorlockRouter.delete('/cards/:id', ...deleteCard);

doorlockRouter.post('/:deviceId/open', ...openDoor);

// Device management
doorlockRouter.get('/devices', ...listDevices);
doorlockRouter.get('/devices/:id', ...getDevice);
doorlockRouter.put('/devices/:id', ...upsertDevice); // idempotent create/update
doorlockRouter.delete('/devices/:id', ...deleteDevice);
doorlockRouter.get('/devices/:id/cards', ...listDeviceCards);
doorlockRouter.put('/devices/:id/cards', ...replaceDeviceCards); // replace restrictions
doorlockRouter.get('/devices/:id/status', ...getDeviceStatus);
