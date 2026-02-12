import { rolesFactory } from '#routes/roles/_factory';
import {
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from '#routes/roles/index';

export const rolesRouter = rolesFactory
  .createApp()
  .get('/', ...listRoles)
  .post('/', ...createRole)
  .patch('/:name', ...updateRole)
  .delete('/:name', ...deleteRole);
