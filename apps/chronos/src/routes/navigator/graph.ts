import { and, asc, eq, getTableColumns } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import {
  navigatorCorridor,
  navigatorLift,
  navigatorStair,
} from '#database/schema/navigator';
import { building, classroom, classroomType } from '#database/schema/timetable';
import { navigatorFactory } from '#routes/navigator/_factory';
import { ok } from '#utils/http';
import { graphResponseSchema } from '#utils/navigator/schemas';
import { filcExt } from '#utils/openapi';

export const graphRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit FullGraph'),
    description:
      'The whole campus graph in the upstream wire format, without a session. Only rows the campus has placed on the map appear.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(graphResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Navigator'],
  }),
  async (c) => {
    const [buildings, classroomTypes, classrooms, corridors, lifts, stairs] =
      await Promise.all([
        db
          .select()
          .from(building)
          .where(eq(building.mapped, true))
          .orderBy(asc(building.name)),
        db.select().from(classroomType).orderBy(asc(classroomType.name)),
        // Rooms and structures only reach the graph through a placed building.
        db
          .select({ ...getTableColumns(classroom) })
          .from(classroom)
          .innerJoin(building, eq(classroom.building_id, building.id))
          .where(and(eq(classroom.mapped, true), eq(building.mapped, true)))
          .orderBy(asc(classroom.name)),
        db
          .select({ ...getTableColumns(navigatorCorridor) })
          .from(navigatorCorridor)
          .innerJoin(building, eq(navigatorCorridor.building_id, building.id))
          .where(eq(building.mapped, true))
          .orderBy(asc(navigatorCorridor.name)),
        db
          .select({ ...getTableColumns(navigatorLift) })
          .from(navigatorLift)
          .innerJoin(building, eq(navigatorLift.building_id, building.id))
          .where(eq(building.mapped, true))
          .orderBy(asc(navigatorLift.name)),
        db
          .select({ ...getTableColumns(navigatorStair) })
          .from(navigatorStair)
          .innerJoin(building, eq(navigatorStair.building_id, building.id))
          .where(eq(building.mapped, true))
          .orderBy(asc(navigatorStair.name)),
      ]);

    return ok(c, {
      buildings,
      classroom_types: classroomTypes,
      // The graph's shape has no nullable campus fields: only placed rooms are
      // here, and placing one is what fills them in.
      classrooms: classrooms.map((row) => ({
        ...row,
        capacity: row.capacity ?? 0,
        type_id: row.type_id ?? '',
      })),
      corridors,
      lifts,
      stairs,
    });
  }
);
