import {
  createApiKeyRoute,
  listApiKeysRoute,
  revokeApiKeyRoute,
} from '#routes/users/api-keys';
import { listUsers, updateUser } from '#routes/users/index';

export const usersRouter = {
  list: listUsers,
  me: {
    apiKeys: {
      create: createApiKeyRoute,
      delete: revokeApiKeyRoute,
      list: listApiKeysRoute,
    },
  },
  update: updateUser,
};
