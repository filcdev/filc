import { rateLimit } from '#middleware/rate-limit';
import { base } from '#orpc';
import { bugReportRouter } from '#routes/bug-report/_router';
import { cohortRouter } from '#routes/cohort/_router';
import { dashboardRouter } from '#routes/dashboard/_router';
import { doorlockRouter } from '#routes/doorlock/_router';
import { healthRouter } from '#routes/health/_router';
import { kioskRouter } from '#routes/kiosk/_router';
import { navigatorRouter } from '#routes/navigator/_router';
import { newsRouter } from '#routes/news/_router';
import { notificationsRouter } from '#routes/notifications/_router';
import { pingRouter } from '#routes/ping/_router';
import { rolesRouter } from '#routes/roles/_router';
import { timetableRouter } from '#routes/timetable/_router';
import { usersRouter } from '#routes/users/_router';

/**
 * The implemented contract. `base.router` type-checks this object against
 * `appContract`, so a missing, extra or mistyped procedure fails `tsc`.
 *
 * `use(rateLimit)` is the initial middleware for every procedure, so limiting
 * happens before any per-procedure guard — the order the pre-oRPC global
 * `rateLimiter` middleware had.
 */
export const appRouter = base.use(rateLimit).router({
  bugReport: bugReportRouter,
  cohort: cohortRouter,
  dashboard: dashboardRouter,
  doorlock: doorlockRouter,
  health: healthRouter,
  kiosk: kioskRouter,
  navigator: navigatorRouter,
  news: newsRouter,
  notifications: notificationsRouter,
  ping: pingRouter,
  roles: rolesRouter,
  timetable: timetableRouter,
  users: usersRouter,
});
