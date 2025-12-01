import { cohortFactory } from '@/routes/cohort/_factory';
import { listCohorts } from '@/routes/cohort/index';

export const cohortRouter = cohortFactory.createApp().get('/', ...listCohorts);
