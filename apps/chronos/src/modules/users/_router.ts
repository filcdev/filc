import {
  createApiKeyRoute,
  listApiKeysRoute,
  revokeApiKeyRoute,
} from '#modules/users/api-keys';
import { listUsers, updateUser } from '#modules/users/index';

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
