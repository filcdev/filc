import { Hono } from 'hono';
import { importRoute } from '~/routes/timetable/import';
import {
  createSubstitution,
  deleteSubstitution,
  getAllSubstitutions,
  getRelevantSubstitutions,
  getRelevantSubstitutionsForCohort,
  updateSubstitution,
} from '~/routes/timetable/substitution';
import type { Context } from '~/utils/globals';
import { getLessonsForCohort } from './lesson';

export const timetableRouter = new Hono<Context>()
  .post('/import', ...importRoute)

  .get('/substitutions', ...getAllSubstitutions)
  .get('/substitutions/relevant', ...getRelevantSubstitutions)
  .get('/substitutions/cohort/:cohortId', ...getRelevantSubstitutionsForCohort)

  .post('/substitutions', ...createSubstitution)
  .put('/substitutions/:id', ...updateSubstitution)
  .delete('/substitutions/:id', ...deleteSubstitution)

  .get('/lessons/get_for_cohort/:cohort_id', ...getLessonsForCohort);
