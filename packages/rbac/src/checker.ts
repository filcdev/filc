import type { Prisma } from '@filc/db'

import type { PermissionType } from './permissions'
import { Permission } from './permissions'

type UserWithPermissions = Prisma.UserGetPayload<{
  include: {
    roles: {
      include: {
        permissions: {
          select: { id: true; name: true }
        }
      }
    }
    permissionOverrides: {
      include: {
        permission: true
      }
    }
  }
  omit: { password: true }
}>

export function hasPermission(
  user: UserWithPermissions,
  requiredPermission: PermissionType
): boolean {
  if (
    user.roles.some((role) =>
      role.permissions.some(
        (permission) => permission.name === Permission.ADMIN
      )
    )
  ) {
    return true
  }

  const hasRolePermission = user.roles.some((role) =>
    role.permissions.some(
      (permission) => permission.name === requiredPermission
    )
  )

  if (hasRolePermission) {
    return true
  }

  const override = user.permissionOverrides.find(
    (override) => override.permission.name === requiredPermission
  )

  return override ? override.granted : false
}

export function requirePermission(permission: PermissionType) {
  return (user: UserWithPermissions) => hasPermission(user, permission)
}

export async function hasAnyPermission(
  user: UserWithPermissions,
  permissions: PermissionType[]
): Promise<boolean> {
  return Promise.any(
    permissions.map((permission) => hasPermission(user, permission))
  ).catch(() => false)
}

export function requireAnyPermission(permissions: PermissionType[]) {
  return (user: UserWithPermissions) => hasAnyPermission(user, permissions)
}

export type { PermissionType }
export { Permission }
