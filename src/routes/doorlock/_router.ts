import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { doorlockFactory } from '~/routes/doorlock/_factory';
import { handleFeatureFlag, isFeatureEnabled } from '~/utils/feature-flag';
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
import {
  addUnknownCard,
  getDeviceLogs,
  getLog,
  listLogs,
  listUnknownTags,
} from './logs';
import { openDoor } from './open';

await handleFeatureFlag('doorlock:api', 'Enable doorlock API', false);

export const doorlockRouter = doorlockFactory
  .createApp()
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
  .get('/devices/:id/status', ...getDeviceStatus)
  .get('/devices/:deviceId/logs', ...getDeviceLogs)
  // Access logs
  .get('/logs', ...listLogs)
  .get('/logs/:id', ...getLog)
  .get('/logs/unknown-tags', ...listUnknownTags)
  .post('/logs/add-unknown-card', ...addUnknownCard);
