import type { UserOption } from '@/components/doorlock/doorlock.types';

export function getOwnerLabel(user: UserOption) {
  if (user.nickname && user.name && user.nickname !== user.name) {
    return `${user.nickname} (${user.name})`;
  }

  if (user.nickname) {
    return user.nickname;
  }

  if (user.name) {
    return user.name;
  }

  if (user.email) {
    return user.email;
  }

  return '';
}
