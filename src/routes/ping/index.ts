import { pingFactory } from '~/routes/ping/_factory';
import type { SuccessResponse } from '~/utils/globals';

export const ping = pingFactory.createHandlers((c) => {
  return c.json<SuccessResponse>({
    success: true,
    data: { message: 'pong' },
  });
});
