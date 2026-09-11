import { usersFactory } from '#routes/users/_factory';
import {
  createApiKeyRoute,
  listApiKeysRoute,
  revokeApiKeyRoute,
} from '#routes/users/api-keys';
import { listUsers, updateUser } from '#routes/users/index';
import { getMyProfile } from '#routes/users/profile';

export const usersRouter = usersFactory
  .createApp()
  .get('/', ...listUsers)
  .get('/me/profile', ...getMyProfile)
  .patch('/:id', ...updateUser)
  // API key management (scoped to the authenticated user)
  .get('/me/api-keys', ...listApiKeysRoute)
  .post('/me/api-keys', ...createApiKeyRoute)
  .delete('/me/api-keys/:id', ...revokeApiKeyRoute);
