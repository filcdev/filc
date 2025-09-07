import { Hono } from 'hono';
import { importRoute } from '~/routes/timetable/import/index';
import type { honoContext } from '~/utils/globals';
import {
  requireAuthentication,
  requireAuthorization,
} from '~/utils/middleware';

export const importRouter = new Hono<honoContext>();

importRouter.use(requireAuthentication);
importRouter.use(requireAuthorization('timetable:import'));
importRouter.post('/', ...importRoute);
