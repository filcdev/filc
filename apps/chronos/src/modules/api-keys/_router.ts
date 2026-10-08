import {
  deleteAdminApiKey,
  listAdminApiKeys,
  updateAdminApiKey,
} from '#modules/api-keys/index';

export const apiKeysRouter = {
  delete: deleteAdminApiKey,
  list: listAdminApiKeys,
  update: updateAdminApiKey,
};
