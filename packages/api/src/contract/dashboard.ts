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
        group: 'Dashboard',
        method: 'GET',
        operationId: 'getDashboardStats',
        path: '/dashboard/stats',
        successStatus: 200,
        tags: ['Dashboard'],
        type: '@unit DashboardStatsResponse',
      })
    )
    .input(statsQuerySchema)
    .output(dashboardStatsResponseSchema),
};
