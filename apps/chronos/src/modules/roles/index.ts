import { permissions } from '@filcdev/api/permissions';
import { requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { rbac } from '#utils/authorization';
import { badRequest, conflict, notFound } from '#utils/http';
import { isUniqueViolation } from '#utils/postgres';

export const listPermissions = base.roles.permissions
  .use(requireAuthorization(permissions.rolesRead))
  .handler(() => {
    const allPermissions = rbac.getAllPermissions();

    return { items: allPermissions, total: allPermissions.length };
  });

export const listRoles = base.roles.list
  .use(requireAuthorization(permissions.rolesRead))
  .handler(() => {
    const allRoles = rbac.getAllRoles();

    const roles = Object.entries(allRoles).map(([name, def]) => ({
      can: def.can,
      name,
    }));

    return { items: roles, total: roles.length };
  });

export const createRole = base.roles.create
  .use(requireAuthorization(permissions.rolesManage))
  .handler(async ({ input }) => {
    const { name, permissions: rolePermissions } = input;

    const existingRoles = rbac.getAllRoles();
    if (name in existingRoles) {
      throw conflict(`Role "${name}" already exists`);
    }

    try {
      await rbac.createRole(name, rolePermissions);
    } catch (error) {
      // Postgres unique-violation from a concurrent create. Bun puts the
      // SQLSTATE on `errno` — its `code` is its own string, so comparing that
      // to a SQLSTATE never matched and the race answered 500.
      if (isUniqueViolation(error)) {
        throw conflict(`Role "${name}" already exists`);
      }
      throw error;
    }

    return { can: rolePermissions, name };
  });

export const updateRole = base.roles.update
  .use(requireAuthorization(permissions.rolesManage))
  .handler(async ({ input }) => {
    const { name: roleName, permissions: rolePermissions } = input;
    if (!roleName) {
      throw badRequest('Role name is required');
    }

    const existingRoles = rbac.getAllRoles();
    if (!(roleName in existingRoles)) {
      throw notFound(`Role "${roleName}" not found`);
    }

    await rbac.setPermissions(roleName, rolePermissions);

    return { can: rolePermissions, name: roleName };
  });

export const deleteRole = base.roles.delete
  .use(requireAuthorization(permissions.rolesManage))
  .handler(async ({ input }) => {
    const { name: roleName } = input;

    const existingRoles = rbac.getAllRoles();
    if (!(roleName in existingRoles)) {
      throw notFound(`Role "${roleName}" not found`);
    }

    await rbac.deleteRole(roleName);

    return { ok: true as const };
  });
