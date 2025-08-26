import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultStatements,
  userAc,
} from 'better-auth/plugins/admin/access';

export const statement = {
  ...defaultStatements,
  ping: ['ping', 'uptime'],
} as const;

export const ac = createAccessControl(statement);

const user = ac.newRole({
  ...userAc.statements,
  ping: ['ping'],
});

const admin = ac.newRole({
  ...adminAc.statements,
  ping: ['ping', 'uptime'],
});

export const roles = {
  user,
  admin,
};
