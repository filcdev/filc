import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { isReferencedRowError } from '#modules/navigator/utils/errors';
import { classroomType as classroomTypeTable } from '#modules/timetable/schema';
import { base } from '#orpc';
import { conflict, notFound } from '#utils/http';

export const listClassroomTypesRoute =
  base.navigator.classroomTypes.list.handler(async () => {
    const classroomTypes = await db
      .select()
      .from(classroomTypeTable)
      .orderBy(asc(classroomTypeTable.name));

    return { classroom_types: classroomTypes };
  });

export const createClassroomTypeRoute = base.navigator.classroomTypes.create
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const [classroomType] = await db
      .insert(classroomTypeTable)
      .values({ id: crypto.randomUUID(), ...input })
      .returning();

    if (!classroomType) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to create classroom type',
      });
    }

    return { classroom_type: classroomType };
  });

export const updateClassroomTypeRoute = base.navigator.classroomTypes.update
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id, ...payload } = input;

    // An empty patch is a legal (if pointless) request, and Drizzle refuses to
    // build an `update … set` with no values.
    const [classroomType] =
      Object.keys(payload).length > 0
        ? await db
            .update(classroomTypeTable)
            .set(payload)
            .where(eq(classroomTypeTable.id, id))
            .returning()
        : await db
            .select()
            .from(classroomTypeTable)
            .where(eq(classroomTypeTable.id, id));

    if (!classroomType) {
      throw notFound('Classroom type not found');
    }

    return { classroom_type: classroomType };
  });

export const deleteClassroomTypeRoute = base.navigator.classroomTypes.delete
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id } = input;

    try {
      const [classroomType] = await db
        .delete(classroomTypeTable)
        .where(eq(classroomTypeTable.id, id))
        .returning();

      if (!classroomType) {
        throw notFound('Classroom type not found');
      }

      return { classroom_type: classroomType };
    } catch (error) {
      // `classroom.type_id` restricts the delete, so the FK error is what says
      // a classroom still uses this type.
      if (isReferencedRowError(error)) {
        throw conflict(
          'Classrooms still use this type; reassign them first',
          error
        );
      }
      throw error;
    }
  });
