import { bugReportFactory } from '#routes/bug-report/_factory';
import {
  createBugReport,
  deleteBugReport,
  listBugReports,
  updateBugReportStatus,
} from '#routes/bug-report/index';

export const bugReportRouter = bugReportFactory
  .createApp()
  .post('/', ...createBugReport)
  .get('/', ...listBugReports)
  .patch('/:id/status', ...updateBugReportStatus)
  .delete('/:id', ...deleteBugReport);
