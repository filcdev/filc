import { hc } from 'hono/client';
import type { cohortRouter } from '~/routes/cohort/_router';
import type { pingRouter } from '~/routes/ping/_router';
import type { timetableRouter } from '~/routes/timetable/_router';
import type { authRouter } from '~/utils/authentication';

const dOpts = {
  init: {
    credentials: 'include',
  },
} as const;

export const apiClient = {
  auth: hc<typeof authRouter>('/api/auth', dOpts),
  cohort: hc<typeof cohortRouter>('/api/cohort', dOpts),
  ping: hc<typeof pingRouter>('/api/ping', dOpts),
  timetable: hc<typeof timetableRouter>('/api/timetable', dOpts),
};
