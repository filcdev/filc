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
        group: 'BugReport',
        method: 'POST',
        operationId: 'postBugReport',
        path: '/bug-report',
        successStatus: 201,
        tags: ['Bug Reports'],
        type: '@unit BugReport',
      })
    )
    .input(createBugReportSchema)
    .output(z.object({ id: z.uuid() })),
  delete: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Delete a bug report',
        group: 'BugReport',
        method: 'DELETE',
        operationId: 'deleteBugReportById',
        path: '/bug-report/{id}',
        successStatus: 200,
        tags: ['Bug Reports'],
        type: '@nodata',
      })
    )
    .input(bugReportIdParamsSchema)
    .output(z.object({ id: z.uuid() })),
  list: oc
    .route(
      filcRoute({
        auth: true,
        description: 'List bug reports with optional filters and paging',
        group: 'BugReport',
        method: 'GET',
        operationId: 'getBugReport',
        path: '/bug-report',
        successStatus: 200,
        tags: ['Bug Reports'],
        type: '@unit BugReportListResponse @field(.reports, List<BugReport>)',
      })
    )
    .input(bugReportListQuerySchema)
    .output(bugReportListResponseSchema),
  updateStatus: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Update a bug report status',
        group: 'BugReport',
        method: 'PATCH',
        operationId: 'patchBugReportByIdStatus',
        path: '/bug-report/{id}/status',
        successStatus: 200,
        tags: ['Bug Reports'],
        type: '@unit BugReport',
      })
    )
    .input(updateBugReportStatusInputSchema)
    .output(bugReportSelectSchema),
};
