import { pingFactory } from '~/routes/ping/_factory';

export const ping = pingFactory.createHandlers((c) => {
  return c.json({
    status: 'ok',
  });
});
