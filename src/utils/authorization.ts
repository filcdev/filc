import { getLogger } from '@logtape/logtape';
import RBAC from '@rbac/rbac';
import { eq } from 'drizzle-orm';
import { db } from '~/database';
import { user as dbUser } from '~/database/schema/authentication';
import { role as dbRole } from '~/database/schema/authorization';

const logger = getLogger(['chronos', 'rbac']);

export const rbac = RBAC({
  logger(role, operation, result) {
    logger.info(
      `RBAC check - role: ${role}, operation: ${operation}, result: ${result}`
    );
  },
})({
  user: {
    can: [],
  },
  admin: {
    can: ['*'],
  },
});

export const initializeRBAC = async () => {
  const roles = await db
    .select({
      name: dbRole.name,
      can: dbRole.can,
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

  rbac.updateRoles(rolesObject);
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

  const canPromises = user.roles.map((role) => rbac.can(role, permissionName));

  const canResults = await Promise.all(canPromises);

  return canResults.some((can) => can);
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
      await db
        .insert(dbRole)
        .values({ name: role, can: role === 'admin' ? ['*'] : [] })
        .returning({ can: dbRole.can });
      logger.info(`Created missing role ${role} in the database.`);
      continue;
    }

    for (const perm of rolePermissions.can) {
      permissionsSet.add(perm);
    }
  }

  return Array.from(permissionsSet);
};
