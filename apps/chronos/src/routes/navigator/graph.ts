import { asc } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import {
  navigatorBuilding,
  navigatorClassroom,
  navigatorClassroomType,
  navigatorCorridor,
  navigatorLift,
  navigatorStair,
} from '#database/schema/navigator';
import { ok } from '#utils/http';
import { graphResponseSchema } from '#utils/navigator/schemas';
import { filcExt } from '#utils/openapi';
import { navigatorFactory } from './_factory';

export const graphRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit NavigatorGraphResponse'),
    description:
      'Fetch the complete navigator graph (buildings, classroom types, classrooms, corridors, lifts and stairs).',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(graphResponseSchema),
          },
        },
        description: 'Navigator graph',
      },
    },
    tags: ['Navigator'],
  }),
  async (c) => {
    const [buildings, classrooms, classroomTypes, corridors, lifts, stairs] =
      await Promise.all([
        db
          .select()
          .from(navigatorBuilding)
          .orderBy(asc(navigatorBuilding.name)),
        db
          .select()
          .from(navigatorClassroom)
          .orderBy(
            asc(navigatorClassroom.name),
            asc(navigatorClassroom.buildingId)
          ),
        db
          .select()
          .from(navigatorClassroomType)
          .orderBy(asc(navigatorClassroomType.name)),
        db
          .select()
          .from(navigatorCorridor)
          .orderBy(asc(navigatorCorridor.name)),
        db.select().from(navigatorLift).orderBy(asc(navigatorLift.name)),
        db.select().from(navigatorStair).orderBy(asc(navigatorStair.name)),
      ]);

    return ok(c, {
      buildings,
      classrooms,
      classroomTypes,
      corridors,
      lifts,
      stairs,
    });
  }
);
