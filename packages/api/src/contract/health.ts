import { oc } from '@orpc/contract';
import { healthResponseSchema } from '../domains/health';
import { filcRoute } from './route';

export const healthContract = {
  health: oc
    .route(
      filcRoute({
        description:
          'Readiness probe: answers 200 only when PostgreSQL is reachable.',
        group: 'Health',
        method: 'GET',
        operationId: 'getHealth',
        path: '/health',
        successStatus: 200,
        tags: ['Health'],
        type: '@unit HealthResponse',
      })
    )
    .output(healthResponseSchema),
};
