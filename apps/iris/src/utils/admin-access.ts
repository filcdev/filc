const ADMIN_UI_PERMISSIONS = [
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

export function canAccessAdminUi(permissions?: string[] | null): boolean {
  if (!permissions) {
    return false;
  }

  if (permissions.includes('*')) {
    return true;
  }

  return ADMIN_UI_PERMISSIONS.some((permission) =>
    permissions.includes(permission)
  );
}
