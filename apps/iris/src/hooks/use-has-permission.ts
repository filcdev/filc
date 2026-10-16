import { permissions } from '@filcdev/api/permissions';

export const ADMIN_UI_PERMISSIONS = [
  permissions.importTimetable,
  permissions.substitutionCreate,
  permissions.movedLessonCreate,
  permissions.announcementsCreate,
  permissions.systemMessagesManage,
  permissions.doorlockStatsRead,
  permissions.doorlockDevicesRead,
  permissions.doorlockCardsRead,
  permissions.doorlockLogsRead,
  permissions.usersRead,
  permissions.rolesRead,
  permissions.bugReportsRead,
  permissions.bugReportsWrite,
] as const;

/** Permission predicate. Safe to call from callbacks and non-component code. */
export const hasPermission = (
  permission: string | readonly string[],
  userPermissions?: string[] | null
): boolean => {
  if (!userPermissions) {
    return false;
  }
  const granted = new Set(userPermissions);
  if (granted.has('*')) {
    return true;
  }

  if (typeof permission !== 'string') {
    return permission.some((item) => granted.has(item));
  }

  return granted.has(permission);
};

/** Component-body alias kept for existing call sites. */
export const useHasPermission = hasPermission;
