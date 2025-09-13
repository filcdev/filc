import { Hono } from 'hono';
import { listCohorts } from '~/routes/cohort/index';
import type { honoContext } from '~/utils/globals';

export const cohortRouter = new Hono<honoContext>().get('/', ...listCohorts);
