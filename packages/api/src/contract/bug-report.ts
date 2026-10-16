import { oc } from '@orpc/contract';
import z from 'zod';
import {
  bugReportIdParamsSchema,
  bugReportListQuerySchema,
  bugReportListResponseSchema,
  bugReportSelectSchema,
  createBugReportSchema,
  updateBugReportStatusInputSchema,
} from '../domains/bug-report';
import { filcRoute } from './route';

export const bugReportContract = {
  create: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Create a new bug report',
        method: 'POST',
        operationId: 'postBugReport',
        path: '/bug-report',
        successStatus: 201,
        tags: ['Bug Reports'],
      })
    )
    .input(createBugReportSchema)
    .output(z.object({ id: z.uuid() })),
  delete: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Delete a bug report',
        method: 'DELETE',
        operationId: 'deleteBugReportById',
        path: '/bug-report/{id}',
        tags: ['Bug Reports'],
      })
    )
    .input(bugReportIdParamsSchema)
    .output(z.object({ id: z.uuid() })),
  list: oc
    .route(
      filcRoute({
        auth: true,
        description: 'List bug reports with optional filters and paging',
        method: 'GET',
        operationId: 'getBugReport',
        path: '/bug-report',
        tags: ['Bug Reports'],
      })
    )
    .input(bugReportListQuerySchema)
    .output(bugReportListResponseSchema),
  updateStatus: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Update a bug report status',
        method: 'PATCH',
        operationId: 'patchBugReportByIdStatus',
        path: '/bug-report/{id}/status',
        tags: ['Bug Reports'],
      })
    )
    .input(updateBugReportStatusInputSchema)
    .output(bugReportSelectSchema),
};
