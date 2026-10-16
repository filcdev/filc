import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
} from '#modules/roles/index';

export const rolesRouter = {
  create: createRole,
  delete: deleteRole,
  list: listRoles,
  permissions: listPermissions,
  update: updateRole,
};
