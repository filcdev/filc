import { pingFactory } from '~/routes/ping/_factory';
import { requireAuthorization } from '~/utils/middleware';

export const ping = pingFactory.createHandlers(
  requireAuthorization({ ping: ['ping'] }),
  (c) => {
    return c.json({
      status: 'ok',
    });
  }
);
