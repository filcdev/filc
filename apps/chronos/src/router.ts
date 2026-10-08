import { rateLimit } from '#middleware/rate-limit';
import { apiKeysRouter } from '#modules/api-keys/_router';
import { bugReportRouter } from '#modules/bug-report/_router';
import { cohortRouter } from '#modules/cohort/_router';
import { dashboardRouter } from '#modules/dashboard/_router';
import { doorlockRouter } from '#modules/doorlock/_router';
import { healthRouter } from '#modules/health/_router';
import { kioskRouter } from '#modules/kiosk/_router';
import { navigatorRouter } from '#modules/navigator/_router';
import { newsRouter } from '#modules/news/_router';
import { notificationsRouter } from '#modules/notifications/_router';
import { pingRouter } from '#modules/ping/_router';
import { rolesRouter } from '#modules/roles/_router';
import { timetableRouter } from '#modules/timetable/_router';
import { usersRouter } from '#modules/users/_router';
import { base } from '#orpc';

/**
 * The implemented contract. `base.router` type-checks this object against
 * `appContract`, so a missing, extra or mistyped procedure fails `tsc`.
 *
 * `use(rateLimit)` is the initial middleware for every procedure, so limiting
 * happens before any per-procedure guard — the order the pre-oRPC global
 * `rateLimiter` middleware had.
 */
export const appRouter = base.use(rateLimit).router({
  adminApiKeys: apiKeysRouter,
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
