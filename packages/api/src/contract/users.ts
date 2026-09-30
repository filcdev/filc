import { oc } from '@orpc/contract';
import z from 'zod';
import {
  apiKeyIdParamsSchema,
  apiKeyListResponseSchema,
  apiKeyResponseSchema,
  createApiKeySchema,
} from '../domains/api-keys';
import {
  listUsersQuerySchema,
  updateUserInputSchema,
  usersListResponseSchema,
  userWithPermissionsSchema,
} from '../domains/users';
import { filcRoute } from './route';

export const usersContract = {
  list: oc
    .route(
      filcRoute({
        auth: true,
        description: 'List users',
        group: 'Users',
        method: 'GET',
        operationId: 'getUsers',
        path: '/users',
        successStatus: 200,
        tags: ['Users'],
        type: '@unit UserListResponse @field(.users, List<User>) @field(.total, Int)',
      })
    )
    .input(listUsersQuerySchema)
    .output(usersListResponseSchema),
  me: {
    apiKeys: {
      create: oc
        .route(
          filcRoute({
            auth: true,
            description:
              'Create a new API key for the authenticated user. The raw key is only returned in this response.',
            group: 'Users',
            method: 'POST',
            operationId: 'postUsersMeApiKeys',
            path: '/users/me/api-keys',
            successStatus: 201,
            tags: ['Users'],
            type: '@unit ApiKeyResponse @field(.apiKey, ApiKey) @field(.rawKey, String)',
          })
        )
        .input(createApiKeySchema)
        .output(apiKeyResponseSchema),
      delete: oc
        .route(
          filcRoute({
            auth: true,
            description:
              'Revoke (delete) an API key owned by the authenticated user',
            group: 'Users',
            method: 'DELETE',
            operationId: 'deleteUsersMeApiKeysById',
            path: '/users/me/api-keys/{id}',
            successStatus: 200,
            tags: ['Users'],
            type: '@nodata',
          })
        )
        .input(apiKeyIdParamsSchema)
        .output(z.object({ id: z.uuid() })),
      list: oc
        .route(
          filcRoute({
            auth: true,
            description:
              'List the API keys belonging to the authenticated user',
            group: 'Users',
            method: 'GET',
            operationId: 'getUsersMeApiKeys',
            path: '/users/me/api-keys',
            successStatus: 200,
            tags: ['Users'],
            type: '@unit ApiKeyListResponse @field(.apiKeys, List<ApiKey>)',
          })
        )
        .output(apiKeyListResponseSchema),
    },
  },
  update: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Update user',
        group: 'Users',
        method: 'PATCH',
        operationId: 'patchUsersById',
        path: '/users/{id}',
        successStatus: 200,
        tags: ['Users'],
        type: '@unit User',
      })
    )
    .input(updateUserInputSchema)
    .output(userWithPermissionsSchema),
};
