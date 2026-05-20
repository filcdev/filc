export const ADMIN_UI_PERMISSIONS = [
  'import:timetable',
  'substitution:create',
  'movedLesson:create',
  'announcements:create',
  'system-messages:manage',
  'doorlock:stats:read',
  'doorlock:devices:read',
  'doorlock:cards:read',
  'doorlock:logs:read',
  'users:read',
  'roles:read',
] as const;

export function useHasPermission(
  permission: string | readonly string[],
  permissions?: string[] | null
): boolean {
  if (!permissions) {
    return false;
  }
  if (permissions.includes('*')) {
    return true;
  }

  if (typeof permission !== 'string') {
    return permission.some((item) => permissions.includes(item));
  }

  return permissions.includes(permission);
}
