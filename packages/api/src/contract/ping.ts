import { oc } from '@orpc/contract';
import { pingResponseSchema, uptimeResponseSchema } from '../domains/ping';
import { filcRoute } from './route';

export const pingContract = {
  ping: oc
    .route(
      filcRoute({
        description: 'Health check endpoint that returns a pong response.',
        group: 'Ping',
        method: 'GET',
        operationId: 'getPing',
        path: '/ping',
        successStatus: 200,
        tags: ['Ping'],
        type: '@unit PingResponse',
      })
    )
    .output(pingResponseSchema),
  uptime: oc
    .route(
      filcRoute({
        description: 'Get the uptime.',
        group: 'Ping',
        method: 'GET',
        operationId: 'getPingUptime',
        path: '/ping/uptime',
        successStatus: 200,
        tags: ['Ping'],
        type: '@unit UptimeResponse',
      })
    )
    .output(uptimeResponseSchema),
};
