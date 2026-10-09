import { oc } from '@orpc/contract';
import z from 'zod';
import {
  createRoleSchema,
  permissionsListResponseSchema,
  roleNameParamsSchema,
  rolesListResponseSchema,
  roleWithCapabilitiesSchema,
  updateRoleInputSchema,
} from '../domains/roles';
import { filcRoute } from './route';

export const rolesContract = {
  create: oc
    .route(
      filcRoute({
        description: 'Create a new role',
        method: 'POST',
        operationId: 'postRoles',
        path: '/roles',
        successStatus: 201,
        tags: ['Roles'],
      })
    )
    .input(createRoleSchema)
    .output(roleWithCapabilitiesSchema),
  delete: oc
    .route(
      filcRoute({
        description: 'Delete a role',
        method: 'DELETE',
        operationId: 'deleteRolesByName',
        path: '/roles/{name}',
        successStatus: 200,
        tags: ['Roles'],
      })
    )
    .input(roleNameParamsSchema)
    .output(z.object({ ok: z.literal(true) })),
  list: oc
    .route(
      filcRoute({
        description: 'List all roles with their permissions',
        method: 'GET',
        operationId: 'getRoles',
        path: '/roles',
        successStatus: 200,
        tags: ['Roles'],
      })
    )
    .output(rolesListResponseSchema),
  permissions: oc
    .route(
      filcRoute({
        description: 'List all known permissions registered by the application',
        method: 'GET',
        operationId: 'getRolesPermissions',
        path: '/roles/permissions',
        successStatus: 200,
        tags: ['Roles'],
      })
    )
    .output(permissionsListResponseSchema),
  update: oc
    .route(
      filcRoute({
        description: 'Update permissions for a role',
        method: 'PATCH',
        operationId: 'patchRolesByName',
        path: '/roles/{name}',
        successStatus: 200,
        tags: ['Roles'],
      })
    )
    .input(updateRoleInputSchema)
    .output(roleWithCapabilitiesSchema),
};
