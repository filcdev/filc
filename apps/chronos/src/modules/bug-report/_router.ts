import {
  createBugReport,
  deleteBugReport,
  listBugReports,
  updateBugReportStatus,
} from '#modules/bug-report/index';

export const bugReportRouter = {
  create: createBugReport,
  delete: deleteBugReport,
  list: listBugReports,
  updateStatus: updateBugReportStatus,
};
