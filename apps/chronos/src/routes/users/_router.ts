import { usersFactory } from '#routes/users/_factory';
import { listUsers, updateUser } from '#routes/users/index';

export const usersRouter = usersFactory
  .createApp()
  .get('/', ...listUsers)
  .patch('/:id', ...updateUser);
