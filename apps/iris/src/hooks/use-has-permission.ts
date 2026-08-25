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
] as const;

export function useHasPermission(
  permission: string | readonly string[],
  userPermissions?: string[] | null
): boolean {
  if (!userPermissions) {
    return false;
  }
  if (userPermissions.includes('*')) {
    return true;
  }

  if (typeof permission !== 'string') {
    return permission.some((item) => userPermissions.includes(item));
  }

  return userPermissions.includes(permission);
}
