import { oc } from '@orpc/contract';

import {
  pingResponseSchema,
  serverTimeResponseSchema,
  uptimeResponseSchema,
} from '../domains/ping';
import { filcRoute } from './route';

export const pingContract = {
  ping: oc
    .route(
      filcRoute({
        description: 'Health check endpoint that returns a pong response.',
        method: 'GET',
        operationId: 'getPing',
        path: '/ping',
        tags: ['Ping'],
      })
    )
    .output(pingResponseSchema),
  time: oc
    .route(
      filcRoute({
        description:
          "Returns the current server time in the school's configured timezone (Europe/Budapest by default), so a client can render the authoritative local date and UTC offset without trusting its own clock.",
        method: 'GET',
        operationId: 'getPingTime',
        path: '/ping/time',
        tags: ['Ping'],
      })
    )
    .output(serverTimeResponseSchema),
  uptime: oc
    .route(
      filcRoute({
        description: 'Get the uptime.',
        method: 'GET',
        operationId: 'getPingUptime',
        path: '/ping/uptime',
        tags: ['Ping'],
      })
    )
    .output(uptimeResponseSchema),
};
