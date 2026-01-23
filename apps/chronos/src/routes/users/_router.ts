import { createFactory } from 'hono/factory';
import type { Context } from '#_types/globals';
import { listUsers, updateUser } from '#routes/users/index';

export const usersFactory = createFactory<Context>();
export const usersRouter = usersFactory
  .createApp()
  .get('/', ...listUsers)
  .patch('/:id', ...updateUser);
