import { oc } from '@orpc/contract';
import {
  dashboardStatsResponseSchema,
  statsQuerySchema,
} from '../domains/dashboard';
import { filcRoute } from './route';

export const dashboardContract = {
  stats: oc
    .route(
      filcRoute({
        description: 'Get aggregated dashboard statistics',
        method: 'GET',
        operationId: 'getDashboardStats',
        path: '/dashboard/stats',
        tags: ['Dashboard'],
      })
    )
    .input(statsQuerySchema)
    .output(dashboardStatsResponseSchema),
};
