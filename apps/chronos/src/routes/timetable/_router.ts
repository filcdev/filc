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
import { getLessonsForCohort } from './lesson';

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
  .get('/lessons/getForCohort/:cohort_id', ...getLessonsForCohort)
  // Cohort routes
  .get('/cohorts/getAllForTimetable/:timetable_id', ...getCohortsForTimetable);
