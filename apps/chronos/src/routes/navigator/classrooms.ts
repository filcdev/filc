import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '#database';
import {
  classroom as classroomTable,
  cohort,
  lesson,
  movedLesson,
} from '#database/schema/timetable';
import { requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { conflict, notFound } from '#utils/http';

export const listClassroomsRoute = base.navigator.classrooms.list.handler(
  async () => {
    const classrooms = await db
      .select()
      .from(classroomTable)
      .orderBy(asc(classroomTable.name));

    return { classrooms };
  }
);

export const createClassroomRoute = base.navigator.classrooms.create
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const [classroom] = await db
      .insert(classroomTable)
      .values({ id: crypto.randomUUID(), mapped: true, ...input })
      .returning();

    if (!classroom) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to create classroom',
      });
    }

    return { classroom };
  });

export const updateClassroomRoute = base.navigator.classrooms.update
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id, ...payload } = input;

    // An empty patch is a legal (if pointless) request, and Drizzle refuses to
    // build an `update … set` with no values. A campus save is an admin
    // placing the room, so it is mapped from then on.
    const [classroom] =
      Object.keys(payload).length > 0
        ? await db
            .update(classroomTable)
            .set({ ...payload, mapped: true })
            .where(eq(classroomTable.id, id))
            .returning()
        : await db
            .select()
            .from(classroomTable)
            .where(eq(classroomTable.id, id));

    if (!classroom) {
      throw notFound('Classroom not found');
    }

    return { classroom };
  });

export const deleteClassroomRoute = base.navigator.classrooms.delete
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id } = input;

    // The room rows are the timetable's too, and nothing in the timetable
    // cascades: refuse the delete while any of its own rows still points here,
    // naming the table that blocks it.
    const [moved, scheduled, registered] = await Promise.all([
      db
        .select({ id: movedLesson.id })
        .from(movedLesson)
        .where(eq(movedLesson.room, id))
        .limit(1),
      db
        .select({ id: lesson.id })
        .from(lesson)
        .where(sql`${id} = ANY(${lesson.classroomIds})`)
        .limit(1),
      db
        .select({ id: cohort.id })
        .from(cohort)
        .where(sql`${id} = ANY(${cohort.classroomIds})`)
        .limit(1),
    ]);

    if (moved.length > 0) {
      throw conflict('A moved lesson points at this room');
    }
    if (scheduled.length > 0) {
      throw conflict('Lessons are scheduled in this room');
    }
    if (registered.length > 0) {
      throw conflict('A class is registered to this room');
    }

    const [classroom] = await db
      .delete(classroomTable)
      .where(eq(classroomTable.id, id))
      .returning();

    if (!classroom) {
      throw notFound('Classroom not found');
    }

    return { classroom };
  });
