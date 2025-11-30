import { doorlockFactory } from '~/routes/doorlock/_factory';
import {
  createCardRoute,
  deleteCardRoute,
  listCardsRoute,
  listDoorlockUsersRoute,
  updateCardRoute,
} from '~/routes/doorlock/cards';
import {
  createDeviceRoute,
  deleteDeviceRoute,
  listDevicesRoute,
  updateDeviceRoute,
} from '~/routes/doorlock/devices';
import { listLogsRoute } from '~/routes/doorlock/logs';
import {
  activateVirtualCardRoute,
  listSelfCardsRoute,
  updateSelfCardFrozenRoute,
} from '~/routes/doorlock/self';
import { doorlockStatsRoute } from '~/routes/doorlock/stats';
import { websocketHandler } from '~/routes/doorlock/websocket-handler';

export const doorlockRouter = doorlockFactory
  .createApp()
  .get('/ws', ...websocketHandler)
  // Device routes
  .get('/devices', ...listDevicesRoute)
  .post('/devices', ...createDeviceRoute)
  .put('/devices/:id', ...updateDeviceRoute)
  .delete('/devices/:id', ...deleteDeviceRoute)
  // Card routes
  .get('/cards', ...listCardsRoute)
  .post('/cards', ...createCardRoute)
  .put('/cards/:id', ...updateCardRoute)
  .delete('/cards/:id', ...deleteCardRoute)
  .get('/cards/users', ...listDoorlockUsersRoute)
  // Logs & stats
  .get('/logs', ...listLogsRoute)
  .get('/stats/overview', ...doorlockStatsRoute)
  // Self-service routes
  .get('/self/cards', ...listSelfCardsRoute)
  .put('/self/cards/:id/frozen', ...updateSelfCardFrozenRoute)
  .post('/self/cards/:id/activate', ...activateVirtualCardRoute);
