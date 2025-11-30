import { doorlockFactory } from '~/routes/doorlock/_factory';
import { websocketHandler } from '~/routes/doorlock/websocket-handler';

export const doorlockRouter = doorlockFactory
  .createApp()
  .get('/ws', ...websocketHandler);
