import { oc } from '@orpc/contract';
import { cohortSelectSchema } from '../../domains/cohort';
import { listResponse } from '../../domains/list';
import { getCohortsForTimetableParamsSchema } from '../../domains/timetable/cohort';
import {
  getGroupsForCohortParamsSchema,
  groupResponseSchema,
  selectGroupPayloadSchema,
  selectGroupRequestSchema,
} from '../../domains/timetable/groups';
import {
  getPeriodsQuerySchema,
  periodSelectSchema,
} from '../../domains/timetable/period';
import {
  classroomSelectSchema,
  getAvailableClassroomsQuerySchema,
} from '../../domains/timetable/room';
import { subjectSelectSchema } from '../../domains/timetable/subject';
import {
  getTeacherParamsSchema,
  publicTeacherSchema,
  teacherListItemSchema,
  updateTeacherPayload,
} from '../../domains/timetable/teacher';
import { filcRoute } from '../route';

/** The people and rooms that hang off a timetable: rooms, cohorts, groups, periods, subjects and teachers. */
export const peopleContract = {
  classrooms: {
    getAll: oc
      .route(
        filcRoute({
          description: 'Get all classrooms from the database.',
          method: 'GET',
          operationId: 'getTimetableClassroomsGetAll',
          path: '/timetable/classrooms/getAll',
          tags: ['Classroom'],
        })
      )
      .output(listResponse(classroomSelectSchema)),
    getAvailable: oc
      .route(
        filcRoute({
          description:
            'Get classrooms that are free for a given date, day and period.',
          method: 'GET',
          operationId: 'getTimetableClassroomsGetAvailable',
          path: '/timetable/classrooms/getAvailable',
          tags: ['Classroom'],
        })
      )
      .input(getAvailableClassroomsQuerySchema)
      .output(listResponse(classroomSelectSchema)),
  },
  cohorts: {
    getAllForTimetable: oc
      .route(
        filcRoute({
          description: 'Get cohorts for a given timetable from the database.',
          method: 'GET',
          operationId: 'getTimetableCohortsGetAllForTimetableByTimetableId',
          path: '/timetable/cohorts/getAllForTimetable/{timetableId}',
          tags: ['Cohort'],
        })
      )
      .input(getCohortsForTimetableParamsSchema)
      .output(listResponse(cohortSelectSchema)),
  },
  groups: {
    getForCohort: oc
      .route(
        filcRoute({
          description:
            'Get the groups of a cohort, marking the current user selection.',
          method: 'GET',
          operationId: 'getTimetableGroupsGetForCohortByCohortId',
          path: '/timetable/groups/getForCohort/{cohortId}',
          tags: ['Group'],
        })
      )
      .input(getGroupsForCohortParamsSchema)
      .output(listResponse(groupResponseSchema)),
    select: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Select the group the current user belongs to for a division. Replaces any previous membership in that division.',
          method: 'POST',
          operationId: 'postTimetableGroupsSelect',
          path: '/timetable/groups/select',
          tags: ['Group'],
        })
      )
      .input(selectGroupRequestSchema)
      .output(selectGroupPayloadSchema),
  },
  periods: {
    getAll: oc
      .route(
        filcRoute({
          description:
            'Get all period definitions used in a given timetable, sorted by period number.',
          method: 'GET',
          operationId: 'getTimetablePeriodsGetAll',
          path: '/timetable/periods/getAll',
          tags: ['Period'],
        })
      )
      .input(getPeriodsQuerySchema)
      .output(listResponse(periodSelectSchema)),
  },
  subjects: oc
    .route(
      filcRoute({
        description: 'Get all subjects from the database.',
        method: 'GET',
        operationId: 'getTimetableSubjects',
        path: '/timetable/subjects',
        tags: ['Subject'],
      })
    )
    .output(listResponse(subjectSelectSchema)),
  teachers: {
    getAll: oc
      .route(
        filcRoute({
          description: 'Get all teachers from the database.',
          method: 'GET',
          operationId: 'getTimetableTeachersGetAll',
          path: '/timetable/teachers/getAll',
          tags: ['Teacher'],
        })
      )
      .output(listResponse(publicTeacherSchema)),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List all teachers with their email and linked user.',
          method: 'GET',
          operationId: 'getTimetableTeachers',
          path: '/timetable/teachers',
          tags: ['Teacher'],
        })
      )
      .output(listResponse(teacherListItemSchema)),
    me: oc
      .route(
        filcRoute({
          auth: true,
          description: "Get the signed-in user's linked teacher, if any.",
          method: 'GET',
          operationId: 'getTimetableTeachersMe',
          path: '/timetable/teachers/me',
          tags: ['Teacher'],
        })
      )
      .output(publicTeacherSchema.nullable()),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a teacher email and/or linked user.',
          method: 'PATCH',
          operationId: 'patchTimetableTeachersById',
          path: '/timetable/teachers/{id}',
          tags: ['Teacher'],
        })
      )
      .input(getTeacherParamsSchema.extend(updateTeacherPayload.shape))
      .output(teacherListItemSchema),
  },
};
