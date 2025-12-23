import { timetableFactory } from '#routes/timetable/_factory';
import { importRoute } from '#routes/timetable/import';
import {
  createMovedLesson,
  deleteMovedLesson,
  getAllMovedLessons,
  getMovedLessonsForCohort,
  getRelevantMovedLessons,
  getRelevantMovedLessonsForCohort,
  updateMovedLesson,
} from '#routes/timetable/movedLesson';
import {
  createSubstitution,
  deleteSubstitution,
  getAllSubstitutions,
  getRelevantSubstitutions,
  getRelevantSubstitutionsForCohort,
  updateSubstitution,
} from '#routes/timetable/substitution';
import {
  getAllTimetables,
  getAllValidTimetables,
  getLatestValidTimetable,
} from '.';
import { getCohortsForTimetable } from './cohort';
import {
  getLessonsForCohort,
  getLessonsForRoom,
  getLessonsForTeacher,
} from './lesson';
import { getClassrooms } from './room';
import { getTeachers } from './teacher';

export const timetableRouter = timetableFactory
  .createApp()
  // Timetable routes
  .get('/timetables', ...getAllTimetables)
  .get('/timetables/latestValid', ...getLatestValidTimetable)
  .get('/timetables/valid', ...getAllValidTimetables)
  .post('/import', ...importRoute)
  // Substitution routes
  .get('/substitutions', ...getAllSubstitutions)
  .get('/substitutions/relevant', ...getRelevantSubstitutions)
  .get('/substitutions/cohort/:cohortId', ...getRelevantSubstitutionsForCohort)
  .post('/substitutions', ...createSubstitution)
  .put('/substitutions/:id', ...updateSubstitution)
  .delete('/substitutions/:id', ...deleteSubstitution)
  // Moved lesson routes
  .get('/movedLessons', ...getAllMovedLessons)
  .get('/movedLessons/relevant', ...getRelevantMovedLessons)
  .get('/movedLessons/cohort/:cohortId', ...getMovedLessonsForCohort)
  .get(
    '/movedLessons/cohort/:cohortId/relevant',
    ...getRelevantMovedLessonsForCohort
  )
  .post('/movedLessons', ...createMovedLesson)
  .put('/movedLessons/:id', ...updateMovedLesson)
  .delete('/movedLessons/:id', ...deleteMovedLesson)
  // Lesson routes
  .get('/lessons/get-for-cohort/:cohort_id', ...getLessonsForCohort)
  .get('/lessons/get-for-teacher/:teacher_id', ...getLessonsForTeacher)
  .get('/lessons/get-for-room/:classroom_id', ...getLessonsForRoom)
  // Cohort routes
  .get(
    '/cohorts/get-all-for-timetable/:timetable_id',
    ...getCohortsForTimetable
  )
  // Teacher routes
  .get('/teachers/get-all', ...getTeachers)
  // Classrooms
  .get('/classrooms/get-all', ...getClassrooms);
