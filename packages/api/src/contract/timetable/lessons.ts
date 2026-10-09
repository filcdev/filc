import { oc } from '@orpc/contract';
import {
  enrichedLessonSchema,
  getLessonForIdParamsSchema,
  getLessonsForCohortParamsSchema,
  getLessonsForRoomParamsSchema,
  getLessonsForTeacherParamsSchema,
  getLessonsQuerySchema,
  lessonDetailSchema,
  substitutionCandidatesRequestSchema,
  substitutionCandidatesResultSchema,
  teacherLessonsBatchRequestSchema,
  teacherLessonsBatchResultSchema,
} from '../../domains/timetable/lesson';
import { filcRoute } from '../route';

const enrichedLessonListType =
  '@listof EnrichedLesson @field(.classrooms, List<Classroom>) @field(.cohorts, List<Cohort>) @field(.day, DayDefinition) @field(.period, Period) @field(.subject, Subject) @field(.teachers, List<TeacherSummary>)';

export const lessonsContract = {
  lessons: {
    getForCohort: oc
      .route(
        filcRoute({
          description: 'Get lessons for a given cohort from the database.',
          group: 'Lesson',
          method: 'GET',
          operationId: 'getTimetableLessonsGetForCohortByCohortId',
          path: '/timetable/lessons/getForCohort/{cohortId}',
          successStatus: 200,
          tags: ['Lesson'],
          type: enrichedLessonListType,
        })
      )
      .input(
        getLessonsForCohortParamsSchema.extend(getLessonsQuerySchema.shape)
      )
      .output(enrichedLessonSchema.array()),
    getForId: oc
      .route(
        filcRoute({
          description: 'Get a lesson by its ID from the database.',
          group: 'Lesson',
          method: 'GET',
          operationId: 'getTimetableLessonsGetForIdByLessonId',
          path: '/timetable/lessons/getForId/{lessonId}',
          successStatus: 200,
          tags: ['Lesson'],
          type: '@unit EnrichedLesson @field(.classrooms, List<Classroom>) @field(.day, DayDefinition) @field(.period, Period) @field(.subject, Subject) @field(.teachers, List<TeacherSummary>)',
        })
      )
      .input(getLessonForIdParamsSchema)
      .output(lessonDetailSchema.nullable()),
    getForRoom: oc
      .route(
        filcRoute({
          description: 'Get lessons for a given classroom from the database.',
          group: 'Lesson',
          method: 'GET',
          operationId: 'getTimetableLessonsGetForRoomByClassroomId',
          path: '/timetable/lessons/getForRoom/{classroomId}',
          successStatus: 200,
          tags: ['Lesson'],
          type: enrichedLessonListType,
        })
      )
      .input(getLessonsForRoomParamsSchema.extend(getLessonsQuerySchema.shape))
      .output(enrichedLessonSchema.array()),
    getForTeacher: oc
      .route(
        filcRoute({
          description: 'Get lessons for a given teacher from the database.',
          group: 'Lesson',
          method: 'GET',
          operationId: 'getTimetableLessonsGetForTeacherByTeacherId',
          path: '/timetable/lessons/getForTeacher/{teacherId}',
          successStatus: 200,
          tags: ['Lesson'],
          type: enrichedLessonListType,
        })
      )
      .input(
        getLessonsForTeacherParamsSchema.extend(getLessonsQuerySchema.shape)
      )
      .output(enrichedLessonSchema.array()),
    getForTeachers: oc
      .route(
        filcRoute({
          description: 'Get lessons for multiple teachers in a single request.',
          group: 'Lesson',
          method: 'POST',
          operationId: 'postTimetableLessonsGetForTeachers',
          path: '/timetable/lessons/getForTeachers',
          successStatus: 200,
          tags: ['Lesson'],
          type: '@listof TeacherLessonsBatchResult @field(.teacherId, String) @field(.lessons, List<EnrichedLesson>)',
        })
      )
      .input(teacherLessonsBatchRequestSchema)
      .output(teacherLessonsBatchResultSchema.array()),
    getSubstitutionCandidates: oc
      .route(
        filcRoute({
          description:
            'Get available lessons and substitute teacher candidates for substitution editing in one request.',
          group: 'Lesson',
          method: 'POST',
          operationId: 'postTimetableLessonsGetSubstitutionCandidates',
          path: '/timetable/lessons/getSubstitutionCandidates',
          successStatus: 200,
          tags: ['Lesson'],
          type: '@unit SubstitutionCandidatesResult @field(.availableLessons, List<EnrichedLesson>) @field(.parallelLessons, List<EnrichedLesson>) @field(.substituteCandidates, List<SubstitutionCandidate>)',
        })
      )
      .input(substitutionCandidatesRequestSchema)
      .output(substitutionCandidatesResultSchema),
  },
};
