export function useHasPermission(
  permission: string,
  permissions?: string[] | null
): boolean {
  if (!permissions) {
    return false;
  }
  if (permissions.includes('*')) {
    return true;
  }
  return permissions.includes(permission);
}
