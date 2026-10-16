import { oc } from '@orpc/contract';
import { healthResponseSchema } from '../domains/health';
import { filcRoute } from './route';

export const healthContract = {
  health: oc
    .route(
      filcRoute({
        description:
          'Readiness probe: answers 200 only when PostgreSQL is reachable.',
        method: 'GET',
        operationId: 'getHealth',
        path: '/health',
        tags: ['Health'],
      })
    )
    .output(healthResponseSchema),
};
