import { oc } from '@orpc/contract';
import { listResponse } from '../../domains/list';
import {
  getLessonForIdParamsSchema,
  getLessonsForCohortParamsSchema,
  getLessonsForRoomParamsSchema,
  getLessonsForTeacherParamsSchema,
  getLessonsQuerySchema,
  lessonDetailSchema,
  lessonSchema,
  substitutionCandidatesRequestSchema,
  substitutionCandidatesResultSchema,
  teacherLessonsBatchRequestSchema,
  teacherLessonsBatchResultSchema,
} from '../../domains/timetable/lesson';
import { filcRoute } from '../route';

export const lessonsContract = {
  lessons: {
    getForCohort: oc
      .route(
        filcRoute({
          description: 'Get lessons for a given cohort from the database.',
          method: 'GET',
          operationId: 'getTimetableLessonsGetForCohortByCohortId',
          path: '/timetable/lessons/getForCohort/{cohortId}',
          tags: ['Lesson'],
        })
      )
      .input(
        getLessonsForCohortParamsSchema.extend(getLessonsQuerySchema.shape)
      )
      .output(listResponse(lessonSchema)),
    getForId: oc
      .route(
        filcRoute({
          description: 'Get a lesson by its ID from the database.',
          method: 'GET',
          operationId: 'getTimetableLessonsGetForIdByLessonId',
          path: '/timetable/lessons/getForId/{lessonId}',
          tags: ['Lesson'],
        })
      )
      .input(getLessonForIdParamsSchema)
      .output(lessonDetailSchema.nullable()),
    getForRoom: oc
      .route(
        filcRoute({
          description: 'Get lessons for a given classroom from the database.',
          method: 'GET',
          operationId: 'getTimetableLessonsGetForRoomByClassroomId',
          path: '/timetable/lessons/getForRoom/{classroomId}',
          tags: ['Lesson'],
        })
      )
      .input(getLessonsForRoomParamsSchema.extend(getLessonsQuerySchema.shape))
      .output(listResponse(lessonSchema)),
    getForTeacher: oc
      .route(
        filcRoute({
          description: 'Get lessons for a given teacher from the database.',
          method: 'GET',
          operationId: 'getTimetableLessonsGetForTeacherByTeacherId',
          path: '/timetable/lessons/getForTeacher/{teacherId}',
          tags: ['Lesson'],
        })
      )
      .input(
        getLessonsForTeacherParamsSchema.extend(getLessonsQuerySchema.shape)
      )
      .output(listResponse(lessonSchema)),
    getForTeachers: oc
      .route(
        filcRoute({
          description: 'Get lessons for multiple teachers in a single request.',
          method: 'POST',
          operationId: 'postTimetableLessonsGetForTeachers',
          path: '/timetable/lessons/getForTeachers',
          tags: ['Lesson'],
        })
      )
      .input(teacherLessonsBatchRequestSchema)
      .output(listResponse(teacherLessonsBatchResultSchema)),
    getSubstitutionCandidates: oc
      .route(
        filcRoute({
          description:
            'Get available lessons and substitute teacher candidates for substitution editing in one request.',
          method: 'POST',
          operationId: 'postTimetableLessonsGetSubstitutionCandidates',
          path: '/timetable/lessons/getSubstitutionCandidates',
          tags: ['Lesson'],
        })
      )
      .input(substitutionCandidatesRequestSchema)
      .output(substitutionCandidatesResultSchema),
  },
};
