import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { describeRoute } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { rolesFactory } from '#routes/roles/_factory';
import { rbac } from '#utils/authorization';

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
  requireAuthentication,
  requireAuthorization('roles:read'),
  (c) =>
    c.json<SuccessResponse<{ permissions: string[] }>>({
      data: { permissions: rbac.getAllPermissions() },
      success: true,
    })
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
  requireAuthentication,
  requireAuthorization('roles:read'),
  (c) => {
    const allRoles = rbac.getAllRoles();

    const roles = Object.entries(allRoles).map(([name, def]) => ({
      can: def.can,
      name,
    }));

    return c.json<SuccessResponse<{ roles: typeof roles }>>({
      data: { roles },
      success: true,
    });
  }
);

const createRoleSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9_-]+$/,
      'Role name must be lowercase alphanumeric with dashes or underscores'
    ),
  permissions: z.array(z.string()).default([]),
});

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
  requireAuthentication,
  requireAuthorization('roles:manage'),
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
    } catch (_error) {
      // Catch unique constraint violations from concurrent requests
      throw new HTTPException(StatusCodes.CONFLICT, {
        message: `Role "${name}" already exists`,
      });
    }

    return c.json<SuccessResponse<{ name: string; can: string[] }>>(
      {
        data: { can: permissions, name },
        success: true,
      },
      StatusCodes.CREATED
    );
  }
);

const updateRoleSchema = z.object({
  permissions: z.array(z.string()),
});

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
  requireAuthentication,
  requireAuthorization('roles:manage'),
  zValidator('json', updateRoleSchema),
  async (c) => {
    const roleName = c.req.param('name');
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

    return c.json<SuccessResponse<{ name: string; can: string[] }>>({
      data: { can: permissions, name: roleName },
      success: true,
    });
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
  requireAuthentication,
  requireAuthorization('roles:manage'),
  async (c) => {
    const roleName = c.req.param('name');
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

    await rbac.deleteRole(roleName);

    return c.json<SuccessResponse>({
      success: true,
    });
  }
);
