import { Hono } from 'hono';
import { importRoute } from '~/routes/timetable/import';
import {
  createMovedLesson,
  deleteMovedLesson,
  getAllMovedLessons,
  getMovedLessonsForCohort,
  getRelevantMovedLessons,
  getRelevantMovedLessonsForCohort,
  updateMovedLesson,
} from '~/routes/timetable/movedLesson';
import {
  createSubstitution,
  deleteSubstitution,
  getAllSubstitutions,
  getRelevantSubstitutions,
  getRelevantSubstitutionsForCohort,
  updateSubstitution,
} from '~/routes/timetable/substitution';
import type { Context } from '~/utils/globals';
import {
  getAllTimetables,
  getAllValidTimetables,
  getLatestValidTimetable,
} from '.';
import { getCohortsForTimetable } from './cohort';
import { getLessonsForCohort } from './lesson';

export const timetableRouter = new Hono<Context>()
  // Timetable routes
  .get('/timetables', ...getAllTimetables)
  .get('/timetables/latest-valid', ...getLatestValidTimetable)
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
  .get('/moved-lessons', ...getAllMovedLessons)
  .get('/moved-lessons/relevant', ...getRelevantMovedLessons)
  .get('/moved-lessons/cohort/:cohortId', ...getMovedLessonsForCohort)
  .get(
    '/moved-lessons/cohort/:cohortId/relevant',
    ...getRelevantMovedLessonsForCohort
  )
  .post('/moved-lessons', ...createMovedLesson)
  .put('/moved-lessons/:id', ...updateMovedLesson)
  .delete('/moved-lessons/:id', ...deleteMovedLesson)
  // Lesson routes
  .get('/lessons/get_for_cohort/:cohort_id', ...getLessonsForCohort)
  // Cohort routes
  .get(
    '/cohorts/get-all-for-timetable/:timetable_id',
    ...getCohortsForTimetable
  );
