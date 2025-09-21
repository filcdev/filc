import { Hono } from 'hono';
import { listCohorts } from '~/routes/cohort/index';
import type { Context } from '~/utils/globals';

export const cohortRouter = new Hono<Context>().get('/', ...listCohorts);
