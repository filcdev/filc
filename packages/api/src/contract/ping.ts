import { oc } from '@orpc/contract';
import { pingResponseSchema, uptimeResponseSchema } from '../domains/ping';
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
