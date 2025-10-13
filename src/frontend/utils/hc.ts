import { hc } from 'hono/client';
import type { cohortRouter } from '~/routes/cohort/_router';
import type { doorlockRouter } from '~/routes/doorlock/_router';
import type { featureFlagRouter } from '~/routes/feature-flags/_router';
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
  doorlock: hc<typeof doorlockRouter>('/api/doorlock', dOpts),
  featureFlags: hc<typeof featureFlagRouter>('/api/feature-flags', dOpts),
  ping: hc<typeof pingRouter>('/api/ping', dOpts),
  timetable: hc<typeof timetableRouter>('/api/timetable', dOpts),
};
