import { bugReportFactory } from '#routes/bug-report/_factory';
import { createBugReport, listBugReports } from '#routes/bug-report/index';

export const bugReportRouter = bugReportFactory
  .createApp()
  .post('/', ...createBugReport)
  .get('/', ...listBugReports);
