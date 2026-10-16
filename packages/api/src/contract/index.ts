import { oc } from '@orpc/contract';
import { apiErrors } from '../errors';
import { adminApiKeysContract } from './admin-api-keys';
import { bugReportContract } from './bug-report';
import { cohortContract } from './cohort';
import { dashboardContract } from './dashboard';
import { doorlockContract } from './doorlock';
import { healthContract } from './health';
import { kioskContract } from './kiosk';
import { navigatorContract } from './navigator';
import { newsContract } from './news';
import { notificationsContract } from './notifications';
import { pingContract } from './ping';
import { rolesContract } from './roles';
import { timetableContract } from './timetable';
import { usersContract } from './users';
import { wifiContract } from './wifi';

/**
 * The whole Chronos API: one procedure per endpoint, implemented by
 * `apps/chronos/src/router.ts` and consumed by iris, kiosk and mergen (the
 * latter over the generated OpenAPI document).
 *
 * `oc.errors(apiErrors)` installs the shared error map on every procedure, so
 * each code carries its HTTP status, its default message and its documented
 * error response.
 */
export const appContract = oc.errors(apiErrors).router({
  adminApiKeys: adminApiKeysContract,
  bugReport: bugReportContract,
  cohort: cohortContract,
  dashboard: dashboardContract,
  doorlock: doorlockContract,
  health: healthContract,
  kiosk: kioskContract,
  navigator: navigatorContract,
  news: newsContract,
  notifications: notificationsContract,
  ping: pingContract,
  roles: rolesContract,
  timetable: timetableContract,
  users: usersContract,
  wifi: wifiContract,
});

export type AppContract = typeof appContract;
