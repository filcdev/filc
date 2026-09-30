import { oc } from '@orpc/contract';
import z from 'zod';
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
          group: 'Timetable',
          method: 'POST',
          operationId: 'postTimetableTimetablesCleanupOrphanedCohorts',
          path: '/timetable/timetables/cleanup-orphaned-cohorts',
          successStatus: 200,
          tags: ['Timetable'],
          type: '@unit Timetable',
        })
      )
      .output(cleanupOrphanedCohortsPayloadSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Delete a timetable and all its related data, including orphaned cohorts.',
          group: 'Timetable',
          method: 'DELETE',
          operationId: 'deleteTimetableTimetablesById',
          path: '/timetable/timetables/{id}',
          successStatus: 200,
          tags: ['Timetable'],
          type: '@unit Timetable',
        })
      )
      .input(timetableIdParamsSchema)
      .output(deleteTimetablePayloadSchema),
    latestValid: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get the latest valid timetable.',
          group: 'Timetable',
          method: 'GET',
          operationId: 'getTimetableTimetablesLatestValid',
          path: '/timetable/timetables/latestValid',
          successStatus: 200,
          tags: ['Timetable'],
          type: '@unit Timetable',
        })
      )
      .output(timetableSelectSchema),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get all timetables from the database.',
          group: 'Timetable',
          method: 'GET',
          operationId: 'getTimetableTimetables',
          path: '/timetable/timetables',
          successStatus: 200,
          tags: ['Timetable'],
          type: '@listof Timetable',
        })
      )
      .output(z.array(timetableSelectSchema)),
    previewDelete: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Preview the impact of deleting a timetable. Orphaned cohorts will be deleted along with the timetable.',
          group: 'Timetable',
          method: 'GET',
          operationId: 'getTimetableTimetablesByIdPreviewDelete',
          path: '/timetable/timetables/{id}/preview-delete',
          successStatus: 200,
          tags: ['Timetable'],
          type: '@unit Timetable',
        })
      )
      .input(timetableIdParamsSchema)
      .output(previewDeletePayloadSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a timetable validity dates.',
          group: 'Timetable',
          method: 'PATCH',
          operationId: 'patchTimetableTimetablesById',
          path: '/timetable/timetables/{id}',
          successStatus: 200,
          tags: ['Timetable'],
          type: '@unit Timetable',
        })
      )
      .input(timetableIdParamsSchema.extend(updateTimetableSchema.shape))
      .output(timetableSelectSchema),
    valid: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get all the latest valid timetables.',
          group: 'Timetable',
          method: 'GET',
          operationId: 'getTimetableTimetablesValid',
          path: '/timetable/timetables/valid',
          successStatus: 200,
          tags: ['Timetable'],
          type: '@listof Timetable',
        })
      )
      .output(z.array(timetableSelectSchema)),
  },
};
