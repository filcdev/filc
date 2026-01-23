import { createFactory } from 'hono/factory';
import type { Context } from '#_types/globals';
import { listCohorts } from '#routes/cohort/index';

export const cohortFactory = createFactory<Context>();
export const cohortRouter = cohortFactory.createApp().get('/', ...listCohorts);
