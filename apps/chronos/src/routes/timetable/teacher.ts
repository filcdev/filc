import type { TeacherListItem } from '@filcdev/api/domains/timetable/teacher';
import { permissions } from '@filcdev/api/permissions';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { teacher } from '#database/schema/timetable';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { badRequest, notFound } from '#utils/http';

/**
 * Public teacher list used by the timetable filter bars and substitution
 * pickers. Projects only non-sensitive columns; email and the linked user stay
 * behind the admin endpoints.
 */
export const getTeachers = base.timetable.teachers.getAll.handler(async () => {
  const teachers = await db
    .select({
      firstName: teacher.firstName,
      id: teacher.id,
      lastName: teacher.lastName,
      short: teacher.short,
    })
    .from(teacher);

  return teachers;
});

/**
 * The signed-in user's linked teacher, or null when the account isn't tied to
 * a teacher row. Lets teacher accounts default to the teacher view.
 */
export const getMyTeacher = base.timetable.teachers.me
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const userId = context.session.userId;

    const [row] = await db
      .select({
        firstName: teacher.firstName,
        id: teacher.id,
        lastName: teacher.lastName,
        short: teacher.short,
      })
      .from(teacher)
      .where(eq(teacher.userId, userId))
      .orderBy(teacher.id)
      .limit(1);

    context.resHeaders?.set('Cache-Control', 'no-store');
    return row ?? null;
  });

/** Admin teacher list, including email and the linked user account. */
export const listTeachersAdmin = base.timetable.teachers.list
  .use(requireAuthorization(permissions.teacherManage))
  .handler(async () => {
    const rows = await db
      .select({
        email: teacher.email,
        firstName: teacher.firstName,
        id: teacher.id,
        lastName: teacher.lastName,
        short: teacher.short,
        userEmail: user.email,
        userId: teacher.userId,
        userName: user.name,
      })
      .from(teacher)
      .leftJoin(user, eq(user.id, teacher.userId));

    const data: TeacherListItem[] = rows.map((row) => ({
      email: row.email,
      firstName: row.firstName,
      id: row.id,
      lastName: row.lastName,
      short: row.short,
      user: row.userId
        ? {
            email: row.userEmail ?? '',
            id: row.userId,
            name: row.userName ?? '',
          }
        : null,
      userId: row.userId,
    }));

    return data;
  });

/** Manually set a teacher's email and/or linked user. */
export const updateTeacher = base.timetable.teachers.update
  .use(requireAuthorization(permissions.teacherManage))
  .handler(async ({ input }) => {
    const { id, ...body } = input;

    const [existing] = await db
      .select({ id: teacher.id })
      .from(teacher)
      .where(eq(teacher.id, id))
      .limit(1);
    if (!existing) {
      throw notFound('Teacher not found');
    }

    if (body.userId !== undefined && body.userId !== null) {
      const [linkedUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, body.userId))
        .limit(1);
      if (!linkedUser) {
        throw badRequest('The linked user does not exist');
      }
    }

    let email: string | null | undefined;
    if (body.email === undefined) {
      email = undefined;
    } else if (body.email === null) {
      email = null;
    } else {
      email = body.email.toLowerCase();
    }

    await db
      .update(teacher)
      .set({
        email,
        userId: body.userId,
      })
      .where(eq(teacher.id, id));

    const [updated] = await db
      .select({
        email: teacher.email,
        firstName: teacher.firstName,
        id: teacher.id,
        lastName: teacher.lastName,
        short: teacher.short,
        userEmail: user.email,
        userId: teacher.userId,
        userName: user.name,
      })
      .from(teacher)
      .leftJoin(user, eq(user.id, teacher.userId))
      .where(eq(teacher.id, id))
      .limit(1);

    if (!updated) {
      throw notFound('Teacher not found');
    }

    const data: TeacherListItem = {
      email: updated.email,
      firstName: updated.firstName,
      id: updated.id,
      lastName: updated.lastName,
      short: updated.short,
      user: updated.userId
        ? {
            email: updated.userEmail ?? '',
            id: updated.userId,
            name: updated.userName ?? '',
          }
        : null,
      userId: updated.userId,
    };

    return data;
  });
