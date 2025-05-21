import { createAccessControl } from 'better-auth/plugins/access'
import {
  adminAc,
  defaultStatements,
} from 'better-auth/plugins/organization/access'

const statements = {
  ...defaultStatements,
  organization: ['create', 'read', 'update', 'delete'],
  user: ['create', 'read', 'update', 'delete'],
  room: ['create', 'read', 'update', 'delete'],
  subject: ['create', 'read', 'update', 'delete'],
  teacher: ['create', 'read', 'update', 'delete'],
  cohort: ['create', 'read', 'update', 'delete'],
  group: ['create', 'read', 'update', 'delete'],
  period: ['create', 'read', 'update', 'delete'],
  lesson: ['create', 'read', 'update', 'delete'],
  lessonPeriod: ['create', 'read', 'update', 'delete'],
  substitution: ['create', 'read', 'update', 'delete'],
  timetable: ['create', 'read', 'update', 'delete'],
  timetableDay: ['create', 'read', 'update', 'delete'],
}

export const ac = createAccessControl(statements)

// grant all permissions to the root role
export const root = ac.newRole({
  organization: ['create', 'read', 'update', 'delete'],
  user: ['create', 'read', 'update', 'delete'],
  room: ['create', 'read', 'update', 'delete'],
  subject: ['create', 'read', 'update', 'delete'],
  teacher: ['create', 'read', 'update', 'delete'],
  cohort: ['create', 'read', 'update', 'delete'],
  group: ['create', 'read', 'update', 'delete'],
  period: ['create', 'read', 'update', 'delete'],
  lesson: ['create', 'read', 'update', 'delete'],
  lessonPeriod: ['create', 'read', 'update', 'delete'],
  substitution: ['create', 'read', 'update', 'delete'],
  timetable: ['create', 'read', 'update', 'delete'],
  timetableDay: ['create', 'read', 'update', 'delete'],
})

export const admin = ac.newRole({
  user: ['read', 'update'],
  room: ['create', 'read', 'update', 'delete'],
  subject: ['create', 'read', 'update', 'delete'],
  teacher: ['create', 'read', 'update', 'delete'],
  cohort: ['create', 'read', 'update', 'delete'],
  group: ['create', 'read', 'update', 'delete'],
  period: ['create', 'read', 'update', 'delete'],
  lesson: ['create', 'read', 'update', 'delete'],
  lessonPeriod: ['create', 'read', 'update', 'delete'],
  substitution: ['create', 'read', 'update', 'delete'],
  timetable: ['create', 'read', 'update', 'delete'],
  timetableDay: ['create', 'read', 'update', 'delete'],
  ...adminAc.statements,
})

export const editor = ac.newRole({
  organization: ['read'],
  user: ['read', 'update'],
  room: ['create', 'read', 'update', 'delete'],
  subject: ['create', 'read', 'update', 'delete'],
  teacher: ['read'],
  cohort: ['create', 'read', 'update', 'delete'],
  group: ['create', 'read', 'update', 'delete'],
  period: ['create', 'read', 'update', 'delete'],
  lessonPeriod: ['create', 'read', 'update', 'delete'],
  lesson: ['create', 'read', 'update', 'delete'],
  substitution: ['create', 'read', 'update', 'delete'],
  timetable: ['create', 'read', 'update', 'delete'],
  timetableDay: ['create', 'read', 'update'],
})

export const teacher = ac.newRole({
  organization: ['read'],
  user: ['read', 'update'],
  room: ['read'],
  subject: ['read'],
  teacher: ['read'],
  cohort: ['read'],
  group: ['create', 'read', 'update'],
  period: ['read'],
  lesson: ['read'],
  lessonPeriod: ['read'],
  substitution: ['read'],
  timetable: ['read'],
  timetableDay: ['read'],
})

export const student = ac.newRole({
  organization: ['read'],
  user: ['read', 'update'],
  room: ['read'],
  subject: ['read'],
  teacher: ['read'],
  cohort: ['read'],
  group: ['read'],
  period: ['read'],
  lesson: ['read'],
  lessonPeriod: ['read'],
  substitution: ['read'],
  timetable: ['read'],
  timetableDay: ['read'],
})
