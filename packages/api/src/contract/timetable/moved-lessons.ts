import { oc } from '@orpc/contract';
import z from 'zod';
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

const movedLessonWithRelationsType =
  '@listof MovedLessonWithRelations @field(.movedLesson, MovedLesson) @field(.classroom, Classroom) @field(.dayDefinition, DayDefinition) @field(.period, Period) @field(.lessons, List<EnrichedLesson>)';

export const movedLessonsContract = {
  movedLessons: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a moved lesson.',
          group: 'MovedLesson',
          method: 'POST',
          operationId: 'postTimetableMovedLessons',
          path: '/timetable/movedLessons',
          successStatus: 200,
          tags: ['Moved Lesson'],
          type: '@unit MovedLesson',
        })
      )
      .input(createMovedLessonSchema)
      .output(movedLessonRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a moved lesson',
          group: 'MovedLesson',
          method: 'DELETE',
          operationId: 'deleteTimetableMovedLessonsById',
          path: '/timetable/movedLessons/{id}',
          successStatus: 200,
          tags: ['Moved Lesson'],
          type: '@nodata',
        })
      )
      .input(movedLessonIdParamsSchema)
      .output(z.object({ id: z.string() })),
    export: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Export moved lessons as a CSV file over an optional date range.',
          group: 'MovedLesson',
          method: 'GET',
          operationId: 'getTimetableMovedLessonsExport',
          path: '/timetable/movedLessons/export',
          successStatus: 200,
          tags: ['Moved Lesson'],
          type: 'Export moved lessons as CSV',
        })
      )
      .input(dateRangeQuerySchema)
      .output(z.file()),
    forCohort: oc
      .route(
        filcRoute({
          description: 'Get all moved lessons for a cohort.',
          group: 'MovedLesson',
          method: 'GET',
          operationId: 'getTimetableMovedLessonsCohortByCohortId',
          path: '/timetable/movedLessons/cohort/{cohortId}',
          successStatus: 200,
          tags: ['Moved Lesson'],
          type: movedLessonWithRelationsType,
        })
      )
      .input(cohortIdParamsSchema)
      .output(movedLessonWithRelationsSchema.array()),
    list: oc
      .route(
        filcRoute({
          description: 'Get all moved lessons.',
          group: 'MovedLesson',
          method: 'GET',
          operationId: 'getTimetableMovedLessons',
          path: '/timetable/movedLessons',
          successStatus: 200,
          tags: ['Moved Lesson'],
          type: movedLessonWithRelationsType,
        })
      )
      .output(movedLessonWithRelationsSchema.array()),
    relevant: oc
      .route(
        filcRoute({
          description: 'Get relevant moved lessons for the active timetable.',
          group: 'MovedLesson',
          method: 'GET',
          operationId: 'getTimetableMovedLessonsRelevant',
          path: '/timetable/movedLessons/relevant',
          successStatus: 200,
          tags: ['Moved Lesson'],
          type: movedLessonWithRelationsType,
        })
      )
      .output(movedLessonWithRelationsSchema.array()),
    relevantForCohort: oc
      .route(
        filcRoute({
          description: 'Get all relevant moved lessons for a given cohort.',
          group: 'MovedLesson',
          method: 'GET',
          operationId: 'getTimetableMovedLessonsCohortByCohortIdRelevant',
          path: '/timetable/movedLessons/cohort/{cohortId}/relevant',
          successStatus: 200,
          tags: ['Moved Lesson'],
          type: movedLessonWithRelationsType,
        })
      )
      .input(cohortIdParamsSchema)
      .output(movedLessonWithRelationsSchema.array()),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a moved lesson.',
          group: 'MovedLesson',
          method: 'PUT',
          operationId: 'putTimetableMovedLessonsById',
          path: '/timetable/movedLessons/{id}',
          successStatus: 200,
          tags: ['Moved Lesson'],
          type: '@unit MovedLesson',
        })
      )
      .input(movedLessonIdParamsSchema.extend(updateSchema.shape))
      .output(movedLessonRowSchema),
  },
};
