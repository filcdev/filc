import { oc } from '@orpc/contract';
import z from 'zod';
import { cohortSelectSchema } from '../../domains/cohort';
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
          group: 'Classroom',
          method: 'GET',
          operationId: 'getTimetableClassroomsGetAll',
          path: '/timetable/classrooms/getAll',
          successStatus: 200,
          tags: ['Classroom'],
          type: '@listof Classroom',
        })
      )
      .output(z.array(classroomSelectSchema)),
    getAvailable: oc
      .route(
        filcRoute({
          description:
            'Get classrooms that are free for a given date, day and period.',
          group: 'Classroom',
          method: 'GET',
          operationId: 'getTimetableClassroomsGetAvailable',
          path: '/timetable/classrooms/getAvailable',
          successStatus: 200,
          tags: ['Classroom'],
          type: '@listof Classroom',
        })
      )
      .input(getAvailableClassroomsQuerySchema)
      .output(z.array(classroomSelectSchema)),
  },
  cohorts: {
    getAllForTimetable: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get cohorts for a given timetable from the database.',
          group: 'Cohort',
          method: 'GET',
          operationId: 'getTimetableCohortsGetAllForTimetableByTimetableId',
          path: '/timetable/cohorts/getAllForTimetable/{timetableId}',
          successStatus: 200,
          tags: ['Cohort'],
          type: '@listof Cohort',
        })
      )
      .input(getCohortsForTimetableParamsSchema)
      .output(z.array(cohortSelectSchema)),
  },
  groups: {
    getForCohort: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Get the groups of a cohort, marking the current user selection.',
          group: 'Group',
          method: 'GET',
          operationId: 'getTimetableGroupsGetForCohortByCohortId',
          path: '/timetable/groups/getForCohort/{cohortId}',
          successStatus: 200,
          tags: ['Group'],
          type: '@listof Group',
        })
      )
      .input(getGroupsForCohortParamsSchema)
      .output(z.array(groupResponseSchema)),
    select: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Select the group the current user belongs to for a division. Replaces any previous membership in that division.',
          group: 'Group',
          method: 'POST',
          operationId: 'postTimetableGroupsSelect',
          path: '/timetable/groups/select',
          successStatus: 200,
          tags: ['Group'],
          type: '@object Group @field(.selectedGroupId, string) @field(.divisionTag, string)',
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
          group: 'Period',
          method: 'GET',
          operationId: 'getTimetablePeriodsGetAll',
          path: '/timetable/periods/getAll',
          successStatus: 200,
          tags: ['Period'],
          type: '@listof Period',
        })
      )
      .input(getPeriodsQuerySchema)
      .output(z.array(periodSelectSchema)),
  },
  subjects: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Get all subjects from the database.',
        group: 'Subject',
        method: 'GET',
        operationId: 'getTimetableSubjects',
        path: '/timetable/subjects',
        successStatus: 200,
        tags: ['Subject'],
        type: '@listof Subject',
      })
    )
    .output(z.array(subjectSelectSchema)),
  teachers: {
    getAll: oc
      .route(
        filcRoute({
          description: 'Get all teachers from the database.',
          group: 'Teacher',
          method: 'GET',
          operationId: 'getTimetableTeachersGetAll',
          path: '/timetable/teachers/getAll',
          successStatus: 200,
          tags: ['Teacher'],
          type: '@listof Teacher',
        })
      )
      .output(z.array(publicTeacherSchema)),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List all teachers with their email and linked user.',
          group: 'Teacher',
          method: 'GET',
          operationId: 'getTimetableTeachers',
          path: '/timetable/teachers',
          successStatus: 200,
          tags: ['Teacher'],
          type: '@listof @unit TeacherListItem',
        })
      )
      .output(z.array(teacherListItemSchema)),
    me: oc
      .route(
        filcRoute({
          auth: true,
          description: "Get the signed-in user's linked teacher, if any.",
          group: 'Teacher',
          method: 'GET',
          operationId: 'getTimetableTeachersMe',
          path: '/timetable/teachers/me',
          successStatus: 200,
          tags: ['Teacher'],
          type: '@unit Teacher',
        })
      )
      .output(publicTeacherSchema.nullable()),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a teacher email and/or linked user.',
          group: 'Teacher',
          method: 'PATCH',
          operationId: 'patchTimetableTeachersById',
          path: '/timetable/teachers/{id}',
          successStatus: 200,
          tags: ['Teacher'],
          type: '@unit TeacherListItem',
        })
      )
      .input(getTeacherParamsSchema.extend(updateTeacherPayload.shape))
      .output(teacherListItemSchema),
  },
};
