import type {
  CohortRouter,
  DoorlockRouter,
  PingRouter,
  RolesRouter,
  TimetableRouter,
  UsersRouter,
} from '@filcdev/chronos/types/hc';
import { hc } from 'hono/client';

const dOpts = {
  init: {
    credentials: 'include',
  },
} as const;

export const api = {
  cohort: hc<CohortRouter>('/api/cohort', dOpts),
  doorlock: hc<DoorlockRouter>('/api/doorlock', dOpts),
  ping: hc<PingRouter>('/api/ping', dOpts),
  roles: hc<RolesRouter>('/api/roles', dOpts),
  timetable: hc<TimetableRouter>('/api/timetable', dOpts),
  users: hc<UsersRouter>('/api/users', dOpts),
};
