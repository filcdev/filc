import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
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
  navigatorTranslation,
} from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import { badRequest, ok } from '#utils/http';
import { navigatorTransferSchema } from '#utils/navigator/transfer';
import { filcExt } from '#utils/openapi';
import { navigatorFactory } from './_factory';

const { schema: navigatorTransferRequestSchema } = await resolver(
  navigatorTransferSchema
).toOpenAPISchema();

export const exportNavigatorRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit NavigatorTransfer', true),
    description:
      'Export all navigator data (buildings, classroom types, classrooms, corridors, lifts, stairs and translations) as a JSON file.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(navigatorTransferSchema),
          },
        },
        description: 'Navigator export JSON file',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  async (c) => {
    const [
      buildings,
      classroomTypes,
      classrooms,
      corridors,
      lifts,
      stairs,
      translations,
    ] = await Promise.all([
      db.select().from(navigatorBuilding).orderBy(asc(navigatorBuilding.name)),
      db
        .select()
        .from(navigatorClassroomType)
        .orderBy(asc(navigatorClassroomType.name)),
      db
        .select()
        .from(navigatorClassroom)
        .orderBy(
          asc(navigatorClassroom.name),
          asc(navigatorClassroom.buildingId)
        ),
      db.select().from(navigatorCorridor).orderBy(asc(navigatorCorridor.name)),
      db.select().from(navigatorLift).orderBy(asc(navigatorLift.name)),
      db.select().from(navigatorStair).orderBy(asc(navigatorStair.name)),
      db
        .select()
        .from(navigatorTranslation)
        .orderBy(
          asc(navigatorTranslation.langKey),
          asc(navigatorTranslation.textKey)
        ),
    ]);

    const payload = navigatorTransferSchema.parse({
      buildings,
      classrooms,
      classroomTypes,
      corridors,
      exportedAt: new Date().toISOString(),
      lifts,
      stairs,
      translations,
      version: 1,
    });

    c.header('Content-Type', 'application/json; charset=utf-8');
    c.header(
      'Content-Disposition',
      'attachment; filename="navigator-export.json"'
    );
    return c.body(JSON.stringify(payload, null, 2));
  }
);

export const importNavigatorRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@nodata', true),
    description:
      'Replace all navigator data with the contents of a navigator export JSON file.',
    requestBody: {
      content: {
        'application/json': {
          schema: navigatorTransferRequestSchema,
        },
      },
      description: 'The navigator export payload to import.',
    },
    responses: {
      200: { description: 'Navigator data imported' },
      400: { description: 'Invalid navigator export payload' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', navigatorTransferSchema),
  async (c) => {
    const payload = c.req.valid('json');

    try {
      await db.transaction(async (tx) => {
        // Delete children before parents so FK constraints hold while wiping.
        await tx.delete(navigatorClassroom);
        await tx.delete(navigatorCorridor);
        await tx.delete(navigatorLift);
        await tx.delete(navigatorStair);
        await tx.delete(navigatorClassroomType);
        await tx.delete(navigatorBuilding);
        await tx.delete(navigatorTranslation);

        // Insert in dependency order so FK references resolve. createdAt and
        // updatedAt are left to the DB defaults.
        if (payload.buildings.length > 0) {
          await tx.insert(navigatorBuilding).values(payload.buildings);
        }
        if (payload.classroomTypes.length > 0) {
          await tx
            .insert(navigatorClassroomType)
            .values(payload.classroomTypes);
        }
        if (payload.classrooms.length > 0) {
          await tx.insert(navigatorClassroom).values(payload.classrooms);
        }
        if (payload.corridors.length > 0) {
          await tx.insert(navigatorCorridor).values(payload.corridors);
        }
        if (payload.lifts.length > 0) {
          await tx.insert(navigatorLift).values(payload.lifts);
        }
        if (payload.stairs.length > 0) {
          await tx.insert(navigatorStair).values(payload.stairs);
        }
        if (payload.translations.length > 0) {
          await tx.insert(navigatorTranslation).values(payload.translations);
        }
      });
    } catch (err) {
      // A malformed file surfaces as a Postgres integrity-constraint violation
      // (SQLSTATE class 23: unique, foreign-key, not-null, check). The
      // transaction rolls back, so nothing is left half-applied.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code?: unknown }).code === 'string' &&
        (err as { code: string }).code.startsWith('23')
      ) {
        throw badRequest('Navigator import payload is invalid', err);
      }
      throw err;
    }

    return ok(c, undefined);
  }
);
