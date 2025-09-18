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
import type { honoContext } from '~/utils/globals';
import { getLessonsForCohort } from './lesson';

export const timetableRouter = new Hono<honoContext>();

timetableRouter.post('/import', ...importRoute);

timetableRouter.get('/substitutions', ...getAllSubstitutions);
timetableRouter.get('/substitutions/relevant', ...getRelevantSubstitutions);
timetableRouter.get(
  '/substitutions/cohort/:cohortId',
  ...getRelevantSubstitutionsForCohort
);

timetableRouter.post('/substitutions', ...createSubstitution);

timetableRouter.put('/substitutions/:id', ...updateSubstitution);

timetableRouter.delete('/substitutions/:id', ...deleteSubstitution);

timetableRouter.get(
  '/lessons/get_for_cohort/:cohort_id',
  ...getLessonsForCohort
);
