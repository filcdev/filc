import { oc } from '@orpc/contract';
import z from 'zod';
import { cohortSelectSchema } from '../domains/cohort';
import { filcRoute } from './route';

export const cohortContract = {
  cohort: oc
    .route(
      filcRoute({
        description: 'List all cohorts',
        group: 'Cohort',
        method: 'GET',
        operationId: 'getCohort',
        path: '/cohort',
        successStatus: 200,
        tags: ['Cohort'],
        type: '@listof Cohort',
      })
    )
    .output(z.array(cohortSelectSchema)),
};
