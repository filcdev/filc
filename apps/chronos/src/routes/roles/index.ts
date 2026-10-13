import {
  createRoleSchema,
  roleNameParamsSchema,
  updateRoleSchema,
} from '@filcdev/api/domains/roles';
import { permissions as permissionNames } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { SQL } from 'bun';
import { arrayContains } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { authRouter } from '#middleware/auth';
import { rolesFactory } from '#routes/roles/_factory';
import { rbac } from '#utils/authorization';
import { ApiHttpError, conflict, created, ok } from '#utils/http';

export const listPermissions = rolesFactory.createHandlers(
  describeRoute({
    description: 'List all known permissions registered by the application',
    responses: {
      200: {
        description: 'List of permissions',
      },
    },
    tags: ['Roles'],
  }),
  ...authRouter(permissionNames.rolesRead),
  (c) => ok(c, { permissions: rbac.getAllPermissions() })
);

export const listRoles = rolesFactory.createHandlers(
  describeRoute({
    description: 'List all roles with their permissions',
    responses: {
      200: {
        description: 'List of roles',
      },
    },
    tags: ['Roles'],
  }),
  ...authRouter(permissionNames.rolesRead),
  (c) => {
    const allRoles = rbac.getAllRoles();

    const roles = Object.entries(allRoles).map(([name, def]) => ({
      can: def.can,
      name,
    }));

    return ok(c, { roles });
  }
);

export const createRole = rolesFactory.createHandlers(
  describeRoute({
    description: 'Create a new role',
    responses: {
      201: {
        description: 'Role created',
      },
    },
    tags: ['Roles'],
  }),
  ...authRouter(permissionNames.rolesManage),
  zValidator('json', createRoleSchema),
  async (c) => {
    const { name, permissions } = c.req.valid('json');

    const existingRoles = rbac.getAllRoles();
    if (name in existingRoles) {
      throw new HTTPException(StatusCodes.CONFLICT, {
        message: `Role "${name}" already exists`,
      });
    }

    try {
      await rbac.createRole(name, permissions);
    } catch (error) {
      if (error instanceof ApiHttpError) {
        throw error;
      }
      // Postgres unique-violation from a concurrent create.
      if (error instanceof SQL.PostgresError && error.code === '23505') {
        throw conflict(`Role "${name}" already exists`);
      }
      throw error;
    }

    return created(c, { can: permissions, name });
  }
);

export const updateRole = rolesFactory.createHandlers(
  describeRoute({
    description: 'Update permissions for a role',
    responses: {
      200: {
        description: 'Role updated',
      },
    },
    tags: ['Roles'],
  }),
  ...authRouter(permissionNames.rolesManage),
  zValidator('json', updateRoleSchema),
  zValidator('param', roleNameParamsSchema),
  async (c) => {
    const { name: roleName } = c.req.valid('param');
    if (!roleName) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Role name is required',
      });
    }

    const existingRoles = rbac.getAllRoles();
    if (!(roleName in existingRoles)) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: `Role "${roleName}" not found`,
      });
    }

    const { permissions } = c.req.valid('json');
    await rbac.setPermissions(roleName, permissions);

    return ok(c, { can: permissions, name: roleName });
  }
);

export const deleteRole = rolesFactory.createHandlers(
  describeRoute({
    description: 'Delete a role',
    responses: {
      200: {
        description: 'Role deleted',
      },
    },
    tags: ['Roles'],
  }),
  ...authRouter(permissionNames.rolesManage),
  zValidator('param', roleNameParamsSchema),
  async (c) => {
    const { name: roleName } = c.req.valid('param');

    const existingRoles = rbac.getAllRoles();
    if (!(roleName in existingRoles)) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: `Role "${roleName}" not found`,
      });
    }

    const [assignedUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(arrayContains(user.roles, [roleName]))
      .limit(1);
    if (assignedUser) {
      throw conflict(`Role "${roleName}" is still assigned to a user`);
    }

    await rbac.deleteRole(roleName);

    return ok(c, undefined);
  }
);
