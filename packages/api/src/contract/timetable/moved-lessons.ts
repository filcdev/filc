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
          description:
            'Create a moved lesson: linked to existing lessons, or manual (a subject plus cohorts, with no source lessons).',
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
          description:
            'Update a moved lesson. Every field is optional and an omitted one keeps its stored value. A moved lesson still has exactly one source, so switching sources must clear the other one explicitly: send `lessonIds: []` together with the manual fields to switch to manual, or `manualCohortIds: []` together with `lessonIds` to switch to linked.',
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
