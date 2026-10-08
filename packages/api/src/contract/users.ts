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
