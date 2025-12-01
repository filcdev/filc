import type { cohortRouter } from '~/routes/cohort/_router';
import type { doorlockRouter } from '~/routes/doorlock/_router';
import type { pingRouter } from '~/routes/ping/_router';
import type { timetableRouter } from '~/routes/timetable/_router';
import type { authRouter } from '~/utils/authentication';

export type AuthRouter = typeof authRouter;
export type CohortRouter = typeof cohortRouter;
export type DoorlockRouter = typeof doorlockRouter;
export type PingRouter = typeof pingRouter;
export type TimetableRouter = typeof timetableRouter;
