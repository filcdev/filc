import { permissions as permissionConstants } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import { user as dbUser } from '#database/schema/authentication';
import { role as dbRole } from '#database/schema/authorization';
import { conflict } from '#utils/http';

const logger = getLogger(['chronos', 'rbac']);

type RoleDefinition = {
  can: string[];
};

class RBAC {
  private readonly roles = new Map<string, RoleDefinition>();
  private readonly registeredPermissions = new Set<string>();

  /** Register a permission as "known" (called automatically by middleware). */
  registerPermission(permission: string): void {
    this.registeredPermissions.add(permission);
  }

  /** Return every permission that has been registered via middleware or manually. */
  getAllPermissions(): string[] {
    return [...this.registeredPermissions].sort((left, right) =>
      left.localeCompare(right)
    );
  }

  loadRoles(roles: Record<string, RoleDefinition>): void {
    this.roles.clear();
    for (const [name, def] of Object.entries(roles)) {
      this.roles.set(name, { can: [...def.can] });
    }
  }

  /** Check whether `roleName` is granted `permission`. Supports `*` wildcard. */
  can(roleName: string, permission: string): boolean {
    const role = this.roles.get(roleName);
    if (!role) {
      logger.trace(
        `RBAC check - role: ${roleName}, operation: ${permission}, result: false (unknown role)`
      );
      return false;
    }

    const result = role.can.includes('*') || role.can.includes(permission);

    logger.trace(
      `RBAC check - role: ${roleName}, operation: ${permission}, result: ${result}`
    );
    return result;
  }

  /** Return permissions registered for a role (empty array if unknown). */
  getPermissionsForRole(roleName: string): string[] {
    return [...(this.roles.get(roleName)?.can ?? [])];
  }

  /** Return a snapshot of every role and its permissions. */
  getAllRoles(): Record<string, RoleDefinition> {
    const snapshot: Record<string, RoleDefinition> = {};
    for (const [name, def] of this.roles) {
      snapshot[name] = { can: [...def.can] };
    }
    return snapshot;
  }

  async createRole(name: string, permissions: string[]): Promise<void> {
    const [inserted] = await db
      .insert(dbRole)
      .values({ can: permissions, name })
      .returning();

    if (!inserted) {
      throw conflict(`Role "${name}" already exists`);
    }

    this.roles.set(name, { can: [...permissions] });
    logger.info(
      `Created role "${name}" with permissions: [${permissions.join(', ')}]`
    );
  }

  async deleteRole(name: string): Promise<void> {
    await db.delete(dbRole).where(eq(dbRole.name, name));
    this.roles.delete(name);
    logger.info(`Deleted role "${name}"`);
  }

  async setPermissions(roleName: string, permissions: string[]): Promise<void> {
    await db
      .update(dbRole)
      .set({ can: permissions })
      .where(eq(dbRole.name, roleName));
    const role = this.roles.get(roleName);
    if (role) {
      role.can = [...permissions];
    }
    logger.info(
      `Updated permissions for role "${roleName}": [${permissions.join(', ')}]`
    );
  }

  async grantPermission(roleName: string, permission: string): Promise<void> {
    const role = this.roles.get(roleName);
    if (!role) {
      logger.warn(`Cannot grant permission – role "${roleName}" not found.`);
      return;
    }
    if (role.can.includes(permission)) {
      return;
    }

    const updated = [...role.can, permission];
    await this.setPermissions(roleName, updated);
  }

  async revokePermission(roleName: string, permission: string): Promise<void> {
    const role = this.roles.get(roleName);
    if (!role) {
      logger.warn(`Cannot revoke permission – role "${roleName}" not found.`);
      return;
    }

    const updated = role.can.filter((p) => p !== permission);
    await this.setPermissions(roleName, updated);
  }
}

export const rbac = new RBAC();

export const initializeRBAC = async () => {
  // Ensure default roles exist to prevent bootstrapping deadlock
  await db
    .insert(dbRole)
    .values([
      { can: ['*'], name: 'admin' },
      { can: [], name: 'user' },
      { can: [permissionConstants.wifiRead], name: 'wifi-viewer' },
      {
        can: [permissionConstants.wifiRead, permissionConstants.wifiWrite],
        name: 'wifi-admin',
      },
    ])
    .onConflictDoNothing();

  const roles = await db
    .select({
      can: dbRole.can,
      name: dbRole.name,
    })
    .from(dbRole);

  logger.debug(`Loaded ${roles.length} roles from the database`);

  const rolesObject = roles.reduce(
    (acc, role) => {
      acc[role.name] = { can: role.can };
      return acc;
    },
    {} as Record<string, { can: string[] }>
  );

  rbac.loadRoles(rolesObject);
};

export const userHasPermission = async (
  userId: string,
  permissionName: string
): Promise<boolean> => {
  const [user] = await db
    .select({
      roles: dbUser.roles,
    })
    .from(dbUser)
    .where(eq(dbUser.id, userId))
    .limit(1);

  if (!user) {
    logger.warn(`User with ID ${userId} not found.`);
    return false;
  }

  if (user.roles.length === 0) {
    logger.warn(`User with ID ${userId} has no roles assigned.`);
    return false;
  }

  return user.roles.some((role) => rbac.can(role, permissionName));
};

export const getUserPermissions = async (userId: string): Promise<string[]> => {
  const [user] = await db
    .select({
      roles: dbUser.roles,
    })
    .from(dbUser)
    .where(eq(dbUser.id, userId))
    .limit(1);

  if (!user) {
    logger.warn(`User with ID ${userId} not found.`);
    return [];
  }

  const permissionsSet = new Set<string>();

  for (const role of user.roles) {
    const [rolePermissions] = await db
      .select({
        can: dbRole.can,
      })
      .from(dbRole)
      .where(eq(dbRole.name, role))
      .limit(1);

    if (!rolePermissions) {
      logger.warn(`Role ${role} not found in the database.`);
      // create it
      await rbac.createRole(role, role === 'admin' ? ['*'] : []);
      continue;
    }

    for (const perm of rolePermissions.can) {
      permissionsSet.add(perm);
    }
  }

  return Array.from(permissionsSet);
};

/**
 * Permissions per role name, creating any role that a user references but
 * that is missing from the role table (mirrors `getUserPermissions`).
 */
const permissionsByRoleName = async (roleNames: string[]) => {
  const permissionsByRole = new Map<string, string[]>();
  if (roleNames.length > 0) {
    const roles = await db
      .select({ can: dbRole.can, name: dbRole.name })
      .from(dbRole)
      .where(inArray(dbRole.name, roleNames));
    for (const role of roles) {
      permissionsByRole.set(role.name, role.can);
    }
  }

  for (const name of roleNames) {
    if (!permissionsByRole.has(name)) {
      logger.warn(`Role ${name} not found in the database.`);
      const can = name === 'admin' ? ['*'] : [];
      await rbac.createRole(name, can);
      permissionsByRole.set(name, can);
    }
  }

  return permissionsByRole;
};

/** Union of the permissions of every role, in stored order, deduplicated. */
const unionRolePermissions = (
  roles: string[],
  permissionsByRole: Map<string, string[]>
): string[] => {
  const permissions = new Set<string>();
  for (const name of roles) {
    for (const permission of permissionsByRole.get(name) ?? []) {
      permissions.add(permission);
    }
  }
  return Array.from(permissions);
};

/**
 * Resolve permissions for many users with a fixed number of queries:
 * one for the users' roles, one for the roles' permissions.
 */
export const getUserPermissionsBulk = async (
  userIds: string[]
): Promise<Map<string, string[]>> => {
  const result = new Map<string, string[]>();
  if (userIds.length === 0) {
    return result;
  }

  const users = await db
    .select({ id: dbUser.id, roles: dbUser.roles })
    .from(dbUser)
    .where(inArray(dbUser.id, userIds));

  const permissionsByRole = await permissionsByRoleName([
    ...new Set(users.flatMap((u) => u.roles)),
  ]);

  for (const user of users) {
    result.set(user.id, unionRolePermissions(user.roles, permissionsByRole));
  }

  return result;
};
