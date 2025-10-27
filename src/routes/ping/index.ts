import { pingFactory } from '~/routes/ping/_factory';
import type { SuccessResponse } from '~/utils/globals';

export const ping = pingFactory.createHandlers((c) =>
  c.json<SuccessResponse>({
    data: { message: 'pong' },
    success: true,
  })
);
