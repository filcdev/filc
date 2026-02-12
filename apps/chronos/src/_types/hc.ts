import type { cohortRouter } from '#routes/cohort/_router';
import type { doorlockRouter } from '#routes/doorlock/_router';
import type { pingRouter } from '#routes/ping/_router';
import type { rolesRouter } from '#routes/roles/_router';
import type { timetableRouter } from '#routes/timetable/_router';
import type { usersRouter } from '#routes/users/_router';

export type CohortRouter = typeof cohortRouter;
export type DoorlockRouter = typeof doorlockRouter;
export type PingRouter = typeof pingRouter;
export type RolesRouter = typeof rolesRouter;
export type TimetableRouter = typeof timetableRouter;
export type UsersRouter = typeof usersRouter;
