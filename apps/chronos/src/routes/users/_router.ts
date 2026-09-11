import { usersFactory } from '#routes/users/_factory';
import {
  createApiKeyRoute,
  listApiKeysRoute,
  revokeApiKeyRoute,
} from '#routes/users/api-keys';
import { listUsers, updateUser } from '#routes/users/index';

export const usersRouter = usersFactory
  .createApp()
  .get('/', ...listUsers)
  .patch('/:id', ...updateUser)
  // API key management (scoped to the authenticated user)
  .get('/me/api-keys', ...listApiKeysRoute)
  .post('/me/api-keys', ...createApiKeyRoute)
  .delete('/me/api-keys/:id', ...revokeApiKeyRoute);
