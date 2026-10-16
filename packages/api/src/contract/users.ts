import { oc } from '@orpc/contract';
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
        method: 'GET',
        operationId: 'getUsers',
        path: '/users',
        tags: ['Users'],
      })
    )
    .input(listUsersQuerySchema)
    .output(usersListResponseSchema),
  update: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Update user',
        method: 'PATCH',
        operationId: 'patchUsersById',
        path: '/users/{id}',
        tags: ['Users'],
      })
    )
    .input(updateUserInputSchema)
    .output(userWithPermissionsSchema),
};
