import { defineRelations } from 'drizzle-orm';
import {
  account,
  session,
  user,
  verification,
} from '#database/schema/authentication';
import {
  auditLog,
  card,
  cardDevice,
  device,
  deviceHealth,
} from '#database/schema/doorlock';
import {
  building,
  classroom,
  cohort,
  cohortGroup,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  movedLesson,
  movedLessonLessonMTM,
  period,
  subject,
  substitution,
  substitutionLessonMTM,
  teacher,
  termDefinition,
  timetable,
  weekDefinition,
} from '#database/schema/timetable';

export const relations = defineRelations(
  {
    account,
    auditLog,
    building,
    card,
    cardDevice,
    classroom,
    cohort,
    cohortGroup,
    dayDefinition,
    device,
    deviceHealth,
    lesson,
    lessonCohortMTM,
    movedLesson,
    movedLessonLessonMTM,
    period,
    session,
    subject,
    substitution,
    substitutionLessonMTM,
    teacher,
    termDefinition,
    timetable,
    user,
    verification,
    weekDefinition,
  },
  (r) => ({
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
    auditLog: {
      card: r.one.card({
        from: r.auditLog.cardId,
        to: r.card.id,
      }),
      device: r.one.device({
        from: r.auditLog.deviceId,
        to: r.device.id,
      }),
    },
    auditLog_user: {
      user: r.one.user({
        from: r.auditLog.userId,
        to: r.user.id,
      }),
    },
    building: {
      classrooms: r.many.classroom(),
    },
    card: {
      devices: r.many.device({
        from: r.card.id.through(r.cardDevice.cardId),
        to: r.device.id.through(r.cardDevice.deviceId),
      }),
      user: r.one.user({
        from: r.card.userId,
        to: r.user.id,
      }),
    },
    cardDevice: {
      card: r.one.card({
        from: r.cardDevice.cardId,
        to: r.card.id,
      }),
    },
    classroom: {
      building: r.one.building({
        from: r.classroom.buildingId,
        to: r.building.id,
      }),
      movedLessons: r.many.movedLesson(),
    },
    cohort: {
      classrooms: r.many.classroom({
        from: r.cohort.classroomIds,
        to: r.classroom.id,
      }),
      groups: r.many.cohortGroup(),
      lessons: r.many.lesson({
        from: r.cohort.id.through(r.lessonCohortMTM.cohortId),
        to: r.lesson.id.through(r.lessonCohortMTM.lessonId),
      }),
      teacher: r.one.teacher({
        from: r.cohort.teacherId,
        to: r.teacher.id,
      }),
      timetable: r.one.timetable({
        from: r.cohort.timetableId,
        to: r.timetable.id,
      }),
    },
    cohortGroup: {
      cohort: r.one.cohort({
        from: r.cohortGroup.cohortId,
        to: r.cohort.id,
      }),
      teacher: r.one.teacher({
        from: r.cohortGroup.teacherId,
        to: r.teacher.id,
      }),
      timetable: r.one.timetable({
        from: r.cohortGroup.timetableId,
        to: r.timetable.id,
      }),
    },
    dayDefinition: {
      lessons: r.many.lesson(),
      movedLessons: r.many.movedLesson(),
    },
    deviceHealth: {
      device: r.one.device({
        from: r.deviceHealth.deviceId,
        to: r.device.id,
      }),
    },
    lesson: {
      classrooms: r.many.classroom({
        from: r.lesson.classroomIds,
        to: r.classroom.id,
      }),
      cohorts: r.many.cohort({
        from: r.lesson.id.through(r.lessonCohortMTM.lessonId),
        to: r.cohort.id.through(r.lessonCohortMTM.cohortId),
      }),
      dayDefinition: r.one.dayDefinition({
        from: r.lesson.dayDefinitionId,
        to: r.dayDefinition.id,
      }),
      groups: r.many.cohortGroup({
        from: r.lesson.groupsIds,
        to: r.cohortGroup.id,
      }),
      movedLessons: r.many.movedLesson({
        from: r.lesson.id.through(r.movedLessonLessonMTM.lessonId),
        to: r.movedLesson.id.through(r.movedLessonLessonMTM.movedLessonId),
      }),
      period: r.one.period({
        from: r.lesson.periodId,
        to: r.period.id,
      }),
      subject: r.one.subject({
        from: r.lesson.subjectId,
        to: r.subject.id,
      }),
      substitutions: r.many.substitution({
        from: r.lesson.id.through(r.substitutionLessonMTM.lessonId),
        to: r.substitution.id.through(r.substitutionLessonMTM.substitutionId),
      }),
      teachers: r.many.teacher({
        from: r.lesson.teacherIds,
        to: r.teacher.id,
      }),
      termDefinition: r.one.termDefinition({
        from: r.lesson.termDefinitionId,
        to: r.termDefinition.id,
      }),
      timetable: r.one.timetable({
        from: r.lesson.timetableId,
        to: r.timetable.id,
      }),
      weekDefinition: r.one.weekDefinition({
        from: r.lesson.weeksDefinitionId,
        to: r.weekDefinition.id,
      }),
    },
    movedLesson: {
      classroom: r.one.classroom({
        from: r.movedLesson.room,
        to: r.classroom.id,
      }),
      lessons: r.many.lesson({
        from: r.movedLesson.id.through(r.movedLessonLessonMTM.movedLessonId),
        to: r.lesson.id.through(r.movedLessonLessonMTM.lessonId),
      }),
      startingDayDefinition: r.one.dayDefinition({
        from: r.movedLesson.startingDayId,
        to: r.dayDefinition.id,
      }),
      startingPeriod: r.one.period({
        from: r.movedLesson.startingPeriodId,
        to: r.period.id,
      }),
    },
    period: {
      lessons: r.many.lesson(),
      movedLessons: r.many.movedLesson(),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    subject: {
      lessons: r.many.lesson(),
    },
    substitution: {
      lessons: r.many.lesson({
        from: r.substitution.id.through(r.substitutionLessonMTM.substitutionId),
        to: r.lesson.id.through(r.substitutionLessonMTM.lessonId),
      }),
      substituter: r.one.teacher({
        from: r.substitution.substituterId,
        to: r.teacher.id,
      }),
    },
    teacher: {
      cohorts: r.many.cohort(),
      groups: r.many.cohortGroup(),
      substitutions: r.many.substitution(),
      user: r.one.user({
        from: r.teacher.userId,
        to: r.user.id,
      }),
    },
    termDefinition: {
      lessons: r.many.lesson(),
    },
    timetable: {
      cohorts: r.many.cohort(),
      groups: r.many.cohortGroup(),
      lessons: r.many.lesson(),
    },
    user: {
      cohort: r.one.cohort({
        from: r.user.cohortId,
        to: r.cohort.id,
      }),
    },
    weekDefinition: {
      lessons: r.many.lesson(),
    },
  })
);
