import { dashboardFactory } from '#routes/dashboard/_factory';
import { getDashboardStats } from '#routes/dashboard/index';

export const dashboardRouter = dashboardFactory
  .createApp()
  .get('/stats', ...getDashboardStats);
