import { oc } from '@orpc/contract';
import { cohortSelectSchema } from '../domains/cohort';
import { listResponse } from '../domains/list';
import { filcRoute } from './route';

export const cohortContract = {
  cohort: oc
    .route(
      filcRoute({
        description: 'List all cohorts',
        method: 'GET',
        operationId: 'getCohort',
        path: '/cohort',
        tags: ['Cohort'],
      })
    )
    .output(listResponse(cohortSelectSchema)),
};
