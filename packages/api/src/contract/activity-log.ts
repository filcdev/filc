import { oc } from '@orpc/contract';
import {
  activityLogListResponseSchema,
  activityLogQuerySchema,
} from '../domains/activity-log';
import { filcRoute } from './route';

export const activityLogContract = {
  list: oc
    .route(
      filcRoute({
        auth: true,
        description: 'List generic admin activity log entries',
        method: 'GET',
        operationId: 'getActivityLog',
        path: '/activity-log',
        tags: ['Activity log'],
      })
    )
    .input(activityLogQuerySchema)
    .output(activityLogListResponseSchema),
};
