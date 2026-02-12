import { rolesFactory } from '#routes/roles/_factory';
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
} from '#routes/roles/index';

export const rolesRouter = rolesFactory
  .createApp()
  .get('/', ...listRoles)
  .get('/permissions', ...listPermissions)
  .post('/', ...createRole)
  .patch('/:name', ...updateRole)
  .delete('/:name', ...deleteRole);
