import { listUsers, updateUser } from '#modules/users/index';

export const usersRouter = {
  list: listUsers,
  update: updateUser,
};
