import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { cohort, cohortGroup, teacher, userGroup } from '#database/schema/timetable';
import { authRouter } from '#middleware/auth';
import { usersFactory } from '#routes/users/_factory';
import { ok } from '#utils/http';
import { filcExt } from '#utils/openapi';

const cohortSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
});

const groupSchema = z.object({
  cohortId: z.string().nullable(),
  divisionTag: z.string().nullable(),
  entireClass: z.boolean(),
  id: z.string(),
  name: z.string(),
  selected: z.literal(true),
});

const teacherSchema = z.object({
  firstName: z.string(),
  id: z.string(),
  lastName: z.string(),
  short: z.string(),
});

const profileResponseSchema = z.object({
  data: z.object({
    cohort: cohortSchema.nullable(),
    groups: z.array(groupSchema),
    teacher: teacherSchema.nullable(),
  }),
  success: z.boolean(),
});

export const getMyProfile = usersFactory.createHandlers(
  describeRoute({
    ...filcExt('Users', '@unit MySchoolProfile', true),
    description:
      'Return the authenticated user school profile: cohort, selected groups and linked teacher record.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(profileResponseSchema),
          },
        },
        description: 'Current school profile',
      },
    },
    tags: ['Users'],
  }),
  ...authRouter(),
  async (c) => {
    const currentUser = c.get('user');
    if (!currentUser) {
      throw new HTTPException(StatusCodes.UNAUTHORIZED);
    }
    const userId = currentUser.id;

    const [currentUserRow] = await db
      .select({ cohortId: userTable.cohortId })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    const [currentCohort] = currentUserRow?.cohortId
      ? await db
          .select({ id: cohort.id, name: cohort.name, short: cohort.short })
          .from(cohort)
          .where(eq(cohort.id, currentUserRow.cohortId))
          .limit(1)
      : [];

    const groups = await db
      .select({
        cohortId: cohortGroup.cohortId,
        divisionTag: cohortGroup.divisionTag,
        entireClass: cohortGroup.entireClass,
        id: cohortGroup.id,
        name: cohortGroup.name,
      })
      .from(userGroup)
      .innerJoin(cohortGroup, eq(cohortGroup.id, userGroup.groupId))
      .where(eq(userGroup.userId, userId));

    const [linkedTeacher] = await db
      .select({
        firstName: teacher.firstName,
        id: teacher.id,
        lastName: teacher.lastName,
        short: teacher.short,
      })
      .from(teacher)
      .where(eq(teacher.userId, userId))
      .limit(1);

    return ok(c, {
      cohort: currentCohort ?? null,
      groups: groups.map((group) => ({ ...group, selected: true as const })),
      teacher: linkedTeacher ?? null,
    });
  }
);
