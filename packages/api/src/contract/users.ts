import { oc } from '@orpc/contract';
import z from 'zod';
import {
  avatarFileInputSchema,
  avatarUploadSchema,
  listUsersQuerySchema,
  updateUserInputSchema,
  userAvatarSchema,
  usersListResponseSchema,
  userWithPermissionsSchema,
} from '../domains/users';
import { filcRoute } from './route';

/** The id a delete answers with. */
const deleteResponseSchema = z.object({ id: z.uuid() });

export const usersContract = {
  avatar: {
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Remove your own profile picture',
          method: 'DELETE',
          operationId: 'deleteUsersAvatar',
          path: '/users/avatar',
          tags: ['Users'],
        })
      )
      .output(deleteResponseSchema),
    // Public on purpose: avatars appear on the public blog too, and the name is
    // the SHA-256 of the bytes, so knowing a URL means having seen the picture.
    get: oc
      .route(
        filcRoute({
          description: 'Get a stored profile picture',
          method: 'GET',
          operationId: 'getUsersAvatarsByFile',
          path: '/users/avatars/{file}',
          tags: ['Users'],
        })
      )
      .input(avatarFileInputSchema)
      .output(z.file()),
    upload: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Replace your own profile picture',
          method: 'POST',
          operationId: 'postUsersAvatar',
          path: '/users/avatar',
          tags: ['Users'],
        })
      )
      .input(avatarUploadSchema)
      .output(userAvatarSchema),
  },
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
