import { timetableFactory } from '#routes/timetable/_factory';
import { getCohortsForTimetable } from '#routes/timetable/cohort';
import {
  exportMovedLessonsRoute,
  exportSubstitutionsRoute,
} from '#routes/timetable/export';
import { importRoute } from '#routes/timetable/import';
import {
  cleanupOrphanedCohortsHandler,
  deleteTimetable,
  getAllTimetables,
  getAllValidTimetables,
  getLatestValidTimetable,
  previewDeleteTimetable,
  updateTimetable,
} from '#routes/timetable/index';
import {
  getLessonForId,
  getLessonsForCohort,
  getLessonsForRoom,
  getLessonsForTeacher,
  getLessonsForTeachers,
  getSubjects,
  getSubstitutionCandidates,
} from '#routes/timetable/lesson';
import {
  createMovedLesson,
  deleteMovedLesson,
  getAllMovedLessons,
  getMovedLessonsForCohort,
  getRelevantMovedLessons,
  getRelevantMovedLessonsForCohort,
  updateMovedLesson,
} from '#routes/timetable/moved-lesson';
import { getPeriodsForTimetable } from '#routes/timetable/period';
import {
  createManualSubstitution,
  createSubstitution,
  deleteSubstitution,
  getAllSubstitutions,
  getRelevantSubstitutions,
  getRelevantSubstitutionsForCohort,
  updateSubstitution,
} from '#routes/timetable/substitution';
import { getAvailableClassrooms, getClassrooms } from './room';
import { getTeachers } from './teacher';

export const timetableRouter = timetableFactory
  .createApp()
  // Timetable routes
  .get('/timetables', ...getAllTimetables)
  .get('/timetables/latestValid', ...getLatestValidTimetable)
  .get('/timetables/valid', ...getAllValidTimetables)
  .patch('/timetables/:id', ...updateTimetable)
  .get('/timetables/:id/preview-delete', ...previewDeleteTimetable)
  .delete('/timetables/:id', ...deleteTimetable)
  .post(
    '/timetables/cleanup-orphaned-cohorts',
    ...cleanupOrphanedCohortsHandler
  )
  .post('/import', ...importRoute)
  // Substitution routes
  .get('/substitutions', ...getAllSubstitutions)
  .get('/substitutions/relevant', ...getRelevantSubstitutions)
  .get('/substitutions/export', ...exportSubstitutionsRoute)
  .get('/substitutions/cohort/:cohortId', ...getRelevantSubstitutionsForCohort)
  .post('/substitutions', ...createSubstitution)
  .post('/substitutions/manual', ...createManualSubstitution)
  .put('/substitutions/:id', ...updateSubstitution)
  .delete('/substitutions/:id', ...deleteSubstitution)
  // Moved lesson routes
  .get('/movedLessons', ...getAllMovedLessons)
  .get('/movedLessons/relevant', ...getRelevantMovedLessons)
  .get('/movedLessons/export', ...exportMovedLessonsRoute)
  .get('/movedLessons/cohort/:cohortId', ...getMovedLessonsForCohort)
  .get(
    '/movedLessons/cohort/:cohortId/relevant',
    ...getRelevantMovedLessonsForCohort
  )
  .post('/movedLessons', ...createMovedLesson)
  .put('/movedLessons/:id', ...updateMovedLesson)
  .delete('/movedLessons/:id', ...deleteMovedLesson)
  // Lesson routes
  .get('/lessons/getForCohort/:cohortId', ...getLessonsForCohort)
  .get('/lessons/getForTeacher/:teacherId', ...getLessonsForTeacher)
  .post('/lessons/getForTeachers', ...getLessonsForTeachers)
  .post('/lessons/getSubstitutionCandidates', ...getSubstitutionCandidates)
  .get('/lessons/getForRoom/:classroomId', ...getLessonsForRoom)
  .get('/lessons/getForId/:lessonId', ...getLessonForId)
  .get('/subjects', ...getSubjects)
  // Period routes
  .get('/periods/getAll', ...getPeriodsForTimetable)
  // Classroom routes
  .get('/classrooms/getAvailable', ...getAvailableClassrooms)
  .get('/classrooms/getAll', ...getClassrooms)
  // Cohort routes
  .get('/cohorts/getAllForTimetable/:timetableId', ...getCohortsForTimetable)
  // Teacher routes
  .get('/teachers/getAll', ...getTeachers);
