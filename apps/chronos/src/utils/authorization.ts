import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { user as dbUser } from '#database/schema/authentication';
import { role as dbRole } from '#database/schema/authorization';

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
    return [...this.registeredPermissions].sort();
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
    await db
      .insert(dbRole)
      .values({ can: permissions, name })
      .onConflictDoNothing();
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
