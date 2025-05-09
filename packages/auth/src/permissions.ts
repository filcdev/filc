import { createAccessControl } from 'better-auth/plugins/access'

const statements = {
  organization: ['create', 'read', 'update', 'delete'],
  user: ['create', 'read', 'update', 'delete'],
  room: ['create', 'read', 'update', 'delete'],
  subject: ['create', 'read', 'update', 'delete'],
  teacher: ['create', 'read', 'update', 'delete'],
  cohort: ['create', 'read', 'update', 'delete'],
  group: ['create', 'read', 'update', 'delete'],
  period: ['create', 'read', 'update', 'delete'],
  lesson: ['create', 'read', 'update', 'delete'],
  substitution: ['create', 'read', 'update', 'delete'],
  timetable: ['create', 'read', 'update', 'delete'],
}

export const ac = createAccessControl(statements)

// grant all permissions to the root role
export const root = ac.newRole(statements)

// TODO: implement the rest of the roles
