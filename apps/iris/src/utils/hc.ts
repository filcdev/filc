import { createApiClient } from '@filcdev/api/client';
import type {
  BugReportRouter,
  CohortRouter,
  DashboardRouter,
  DoorlockRouter,
  NewsRouter,
  NotificationsRouter,
  PingRouter,
  RolesRouter,
  TimetableRouter,
  UsersRouter,
} from '@filcdev/chronos/types/hc';

const clientOptions = {
  init: {
    credentials: 'include',
  } satisfies RequestInit,
};

export const api = {
  bugReport: createApiClient<BugReportRouter>('/api/bug-report', clientOptions),
  cohort: createApiClient<CohortRouter>('/api/cohort', clientOptions),
  dashboard: createApiClient<DashboardRouter>('/api/dashboard', clientOptions),
  doorlock: createApiClient<DoorlockRouter>('/api/doorlock', clientOptions),
  news: createApiClient<NewsRouter>('/api/news', clientOptions),
  notifications: createApiClient<NotificationsRouter>(
    '/api/notifications',
    clientOptions
  ),
  ping: createApiClient<PingRouter>('/api/ping', clientOptions),
  roles: createApiClient<RolesRouter>('/api/roles', clientOptions),
  timetable: createApiClient<TimetableRouter>('/api/timetable', clientOptions),
  users: createApiClient<UsersRouter>('/api/users', clientOptions),
};
