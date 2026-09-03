/**
 * Canonical permission vocabulary for the Filc platform.
 *
 * These strings are the contract between Chronos (`requireAuthorization`)
 * and every client app (UI gating). They are also stored in the `roles`
 * table as role capability entries, so existing values must never be
 * renamed without a data migration.
 */
export const permissions = {
  announcementsCreate: 'announcements:create',
  bugReportsRead: 'bug-reports:read',
  bugReportsWrite: 'bug-reports:write',
  doorlockCardsRead: 'doorlock:cards:read',
  doorlockCardsWrite: 'doorlock:cards:write',
  doorlockDevicesRead: 'doorlock:devices:read',
  doorlockDevicesWrite: 'doorlock:devices:write',
  doorlockLogsRead: 'doorlock:logs:read',
  doorlockStatsRead: 'doorlock:stats:read',
  importTimetable: 'import:timetable',
  movedLessonCreate: 'movedLesson:create',
  rolesRead: 'roles:read',
  substitutionCreate: 'substitution:create',
  systemMessagesManage: 'system-messages:manage',
  teacherManage: 'teacher:manage',
  usersRead: 'users:read',
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];
