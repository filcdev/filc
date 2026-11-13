import { deleteAvatar, getAvatar, uploadAvatar } from '@/modules/users/avatar';
import { listUsers, updateUser } from '@/modules/users/index';

export const usersRouter = {
  avatar: {
    delete: deleteAvatar,
    get: getAvatar,
    upload: uploadAvatar,
  },
  list: listUsers,
  update: updateUser,
};
