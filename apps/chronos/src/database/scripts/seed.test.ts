import process from 'node:process';
import { getLogger } from '@logtape/logtape';
import { getTableName, sql } from 'drizzle-orm';
import { db, prepareDb } from '#database/index';
import { apiKeySchema } from '#database/schema/api-keys';
import {
  authenticationSchema,
  session,
  user,
} from '#database/schema/authentication';
import { authorizationSchema, role } from '#database/schema/authorization';
import { doorlockSchema } from '#modules/doorlock/schema';
import {
  cohort,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  period,
  subject,
  substitution,
  substitutionLessonMTM,
  teacher,
  timetable,
  timetableSchema,
  weekDefinition,
} from '#modules/timetable/schema';
import { wifiSchema } from '#modules/wifi/schema';
import { configureLogger } from '#utils/logger';

/**
 * Deterministic, non-interactive world for the E2E suite (issue #263).
 *
 * Nukes every table (auth included), then seeds:
 *   - two RBAC roles (admin: ['*'], user: []) — boot's `initializeRBAC`
 *     upserts the same four, so this only makes the suite independent of
 *     boot ordering;
 *   - an admin user and a regular user, each with a pre-inserted better-auth
 *     session. The suite signs the token with CHRONOS_AUTH_SECRET itself and
 *   builds `filc.session_token` cookies from it — the same path better-auth
 *   uses, verified live;
 *   - a minimal timetable (timetable, day, week, period, subject, one lesson
 *     for one cohort) with two teachers, the admin's teacher row linked via
 *     `teacher.userId`;
 *   - one substitution replacing the lesson on today's date.
 *
 * Run: `bun run --cwd apps/chronos db:seed:test` with CHRONOS_DATABASE_URL and
 * CHRONOS_AUTH_SECRET pointing at the throwaway E2E database. Idempotent: the
 * truncate makes every run start from zero.
 */

await configureLogger('chronos');
await prepareDb();

const logger = getLogger(['chronos', 'drizzle']);

const ADMIN_USER_ID = '00000000-0000-4000-8000-0000000000a1';
const USER_USER_ID = '00000000-0000-4000-8000-0000000000b2';
const ADMIN_SESSION_TOKEN = 'e2e-admin-session-token';
const USER_SESSION_TOKEN = 'e2e-user-session-token';

const now = new Date();
const sessionExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const today = new Date();

const schema = {
  ...apiKeySchema,
  ...authenticationSchema,
  ...authorizationSchema,
  ...doorlockSchema,
  ...timetableSchema,
  ...wifiSchema,
};

await db.execute(sql.raw('SET session_replication_role = replica;'));
for (const table of Object.values(schema)) {
  logger.info(`Truncating ${getTableName(table)}`);
  await db.delete(table);
}
await db.execute(sql.raw('SET session_replication_role = DEFAULT;'));

await db.insert(role).values([
  { can: ['*'], description: null, name: 'admin' },
  { can: [], description: null, name: 'user' },
]);

const [adminUser, regularUser] = await db
  .insert(user)
  .values([
    {
      createdAt: now,
      email: 'e2e-admin@e2e.filc',
      id: ADMIN_USER_ID,
      name: 'E2E Admin',
      roles: ['admin'],
      updatedAt: now,
    },
    {
      cohortId: '70000000-0000-4000-8000-000000000001',
      createdAt: now,
      email: 'e2e-user@e2e.filc',
      id: USER_USER_ID,
      name: 'E2E Student',
      roles: ['user'],
      updatedAt: now,
    },
  ])
  .returning();

await db.insert(session).values([
  {
    createdAt: now,
    expiresAt: sessionExpiry,
    token: ADMIN_SESSION_TOKEN,
    updatedAt: now,
    userAgent: 'e2e',
    userId: adminUser.id,
  },
  {
    createdAt: now,
    expiresAt: sessionExpiry,
    token: USER_SESSION_TOKEN,
    updatedAt: now,
    userAgent: 'e2e',
    userId: regularUser.id,
  },
]);

await db.insert(timetable).values({
  createdAt: now,
  id: '10000000-0000-4000-8000-000000000001',
  name: 'E2E Timetable',
  updatedAt: now,
  validFrom: '2000-01-01',
});

await db.insert(dayDefinition).values({
  createdAt: now,
  days: ['H'],
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Hétfő',
  short: 'H',
  updatedAt: now,
});

await db.insert(weekDefinition).values({
  createdAt: now,
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Week 1',
  short: 'W1',
  updatedAt: now,
  weeks: ['1'],
});

await db.insert(period).values({
  createdAt: now,
  endTime: '08:45',
  id: '40000000-0000-4000-8000-000000000001',
  period: 1,
  startTime: '08:00',
  updatedAt: now,
});

await db.insert(subject).values({
  createdAt: now,
  id: '50000000-0000-4000-8000-000000000001',
  name: 'Matematika',
  short: 'Mat',
  updatedAt: now,
});

const [linkedTeacher, substituterTeacher] = await db
  .insert(teacher)
  .values([
    {
      email: 'e2e-admin@e2e.filc',
      firstName: 'Alíz',
      id: '60000000-0000-4000-8000-000000000001',
      lastName: 'Tanár',
      short: 'AT',
      userId: adminUser.id,
    },
    {
      email: 'e2e-bob@e2e.filc',
      firstName: 'Bence',
      id: '60000000-0000-4000-8000-000000000002',
      lastName: 'Pótló',
      short: 'BP',
    },
  ])
  .returning();

await db.insert(cohort).values({
  id: '70000000-0000-4000-8000-000000000001',
  name: '9.A',
  short: '9a',
  teacherId: linkedTeacher.id,
  timetableId: '10000000-0000-4000-8000-000000000001',
});

const [lessonRow] = await db
  .insert(lesson)
  .values({
    dayDefinitionId: '20000000-0000-4000-8000-000000000001',
    id: '00000000-0000-4000-8000-0000000000e1',
    periodId: '40000000-0000-4000-8000-000000000001',
    periodsPerWeek: 1,
    subjectId: '50000000-0000-4000-8000-000000000001',
    teacherIds: [linkedTeacher.id],
    timetableId: '10000000-0000-4000-8000-000000000001',
    weeksDefinitionId: '30000000-0000-4000-8000-000000000001',
  })
  .returning();

await db.insert(lessonCohortMTM).values({
  cohortId: '70000000-0000-4000-8000-000000000001',
  lessonId: lessonRow.id,
});

const [substitutionRow] = await db
  .insert(substitution)
  .values({
    comment: 'Seeded E2E substitution',
    date: today,
    id: '80000000-0000-4000-8000-000000000001',
    substituter: substituterTeacher.id,
  })
  .returning();

await db
  .insert(substitutionLessonMTM)
  .values({ lessonId: lessonRow.id, substitutionId: substitutionRow.id });

logger.info('E2E seed complete', {
  adminEmail: adminUser.email,
  regularEmail: regularUser.email,
  substitution: substitutionRow.id,
});

process.exit(0);
