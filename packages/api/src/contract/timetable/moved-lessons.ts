import { oc } from '@orpc/contract';
import z from 'zod';
import { listResponse } from '../../domains/list';
import { dateRangeQuerySchema } from '../../domains/timetable/export';
import {
  cohortIdParamsSchema,
  createMovedLessonSchema,
  movedLessonIdParamsSchema,
  movedLessonRowSchema,
  movedLessonWithRelationsSchema,
  updateSchema,
} from '../../domains/timetable/moved-lesson';
import { filcRoute } from '../route';

export const movedLessonsContract = {
  movedLessons: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a moved lesson.',
          method: 'POST',
          operationId: 'postTimetableMovedLessons',
          path: '/timetable/movedLessons',
          tags: ['Moved Lesson'],
        })
      )
      .input(createMovedLessonSchema)
      .output(movedLessonRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a moved lesson',
          method: 'DELETE',
          operationId: 'deleteTimetableMovedLessonsById',
          path: '/timetable/movedLessons/{id}',
          tags: ['Moved Lesson'],
        })
      )
      .input(movedLessonIdParamsSchema)
      .output(z.object({ id: z.uuid() })),
    export: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Export moved lessons as a CSV file over an optional date range.',
          method: 'GET',
          operationId: 'getTimetableMovedLessonsExport',
          path: '/timetable/movedLessons/export',
          tags: ['Moved Lesson'],
        })
      )
      .input(dateRangeQuerySchema)
      .output(z.file()),
    forCohort: oc
      .route(
        filcRoute({
          description: 'Get all moved lessons for a cohort.',
          method: 'GET',
          operationId: 'getTimetableMovedLessonsCohortByCohortId',
          path: '/timetable/movedLessons/cohort/{cohortId}',
          tags: ['Moved Lesson'],
        })
      )
      .input(cohortIdParamsSchema)
      .output(listResponse(movedLessonWithRelationsSchema)),
    list: oc
      .route(
        filcRoute({
          description: 'Get all moved lessons.',
          method: 'GET',
          operationId: 'getTimetableMovedLessons',
          path: '/timetable/movedLessons',
          tags: ['Moved Lesson'],
        })
      )
      .output(listResponse(movedLessonWithRelationsSchema)),
    relevant: oc
      .route(
        filcRoute({
          description: 'Get relevant moved lessons for the active timetable.',
          method: 'GET',
          operationId: 'getTimetableMovedLessonsRelevant',
          path: '/timetable/movedLessons/relevant',
          tags: ['Moved Lesson'],
        })
      )
      .output(listResponse(movedLessonWithRelationsSchema)),
    relevantForCohort: oc
      .route(
        filcRoute({
          description: 'Get all relevant moved lessons for a given cohort.',
          method: 'GET',
          operationId: 'getTimetableMovedLessonsCohortByCohortIdRelevant',
          path: '/timetable/movedLessons/cohort/{cohortId}/relevant',
          tags: ['Moved Lesson'],
        })
      )
      .input(cohortIdParamsSchema)
      .output(listResponse(movedLessonWithRelationsSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a moved lesson.',
          method: 'PUT',
          operationId: 'putTimetableMovedLessonsById',
          path: '/timetable/movedLessons/{id}',
          tags: ['Moved Lesson'],
        })
      )
      .input(movedLessonIdParamsSchema.extend(updateSchema.shape))
      .output(movedLessonRowSchema),
  },
};
