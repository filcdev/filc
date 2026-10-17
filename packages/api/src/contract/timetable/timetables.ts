import { oc } from '@orpc/contract';
import { listResponse } from '../../domains/list';
import {
  cleanupOrphanedCohortsPayloadSchema,
  deleteTimetablePayloadSchema,
  previewDeletePayloadSchema,
  timetableIdParamsSchema,
  timetableSelectSchema,
  updateTimetableSchema,
} from '../../domains/timetable/timetables';
import { filcRoute } from '../route';

/** Timetable lifecycle: listing, validity windows and deletion. */
export const timetablesContract = {
  timetables: {
    cleanupOrphanedCohorts: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Delete all cohorts that are no longer linked to any timetable (orphaned) and all teachers that are not assigned to any lesson. Users referencing those cohorts will have their cohortId nullified. Teachers still referenced by cohorts, cohort groups, or substitutions are kept.',
          method: 'POST',
          operationId: 'postTimetableTimetablesCleanupOrphanedCohorts',
          path: '/timetable/timetables/cleanup-orphaned-cohorts',
          tags: ['Timetable'],
        })
      )
      .output(cleanupOrphanedCohortsPayloadSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Delete a timetable and all its related data, including orphaned cohorts.',
          method: 'DELETE',
          operationId: 'deleteTimetableTimetablesById',
          path: '/timetable/timetables/{id}',
          tags: ['Timetable'],
        })
      )
      .input(timetableIdParamsSchema)
      .output(deleteTimetablePayloadSchema),
    latestValid: oc
      .route(
        filcRoute({
          description: 'Get the latest valid timetable.',
          method: 'GET',
          operationId: 'getTimetableTimetablesLatestValid',
          path: '/timetable/timetables/latestValid',
          tags: ['Timetable'],
        })
      )
      .output(timetableSelectSchema),
    list: oc
      .route(
        filcRoute({
          description: 'Get all timetables from the database.',
          method: 'GET',
          operationId: 'getTimetableTimetables',
          path: '/timetable/timetables',
          tags: ['Timetable'],
        })
      )
      .output(listResponse(timetableSelectSchema)),
    previewDelete: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Preview the impact of deleting a timetable. Orphaned cohorts will be deleted along with the timetable.',
          method: 'GET',
          operationId: 'getTimetableTimetablesByIdPreviewDelete',
          path: '/timetable/timetables/{id}/preview-delete',
          tags: ['Timetable'],
        })
      )
      .input(timetableIdParamsSchema)
      .output(previewDeletePayloadSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a timetable validity dates.',
          method: 'PATCH',
          operationId: 'patchTimetableTimetablesById',
          path: '/timetable/timetables/{id}',
          tags: ['Timetable'],
        })
      )
      .input(timetableIdParamsSchema.extend(updateTimetableSchema.shape))
      .output(timetableSelectSchema),
    valid: oc
      .route(
        filcRoute({
          description: 'Get all the latest valid timetables.',
          method: 'GET',
          operationId: 'getTimetableTimetablesValid',
          path: '/timetable/timetables/valid',
          tags: ['Timetable'],
        })
      )
      .output(listResponse(timetableSelectSchema)),
  },
};
