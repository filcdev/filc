import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq, isNotNull, sql } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import {
  navigatorCorridor,
  navigatorLift,
  navigatorStair,
  navigatorTranslation,
} from '#database/schema/navigator';
import {
  building as buildingTable,
  classroom as classroomTable,
  classroomType as classroomTypeTable,
  movedLesson,
} from '#database/schema/timetable';
import { authRouter } from '#middleware/auth';
import { navigatorFactory } from '#routes/navigator/_factory';
import { badRequest, ok } from '#utils/http';
import { isIntegrityViolation } from '#utils/navigator/errors';
import {
  importQuerySchema,
  type NavigatorTransfer,
  navigatorImportResponseSchema,
  navigatorImportSchema,
  navigatorTransferResponseSchema,
  navigatorTransferSchema,
} from '#utils/navigator/transfer';
import { filcExt } from '#utils/openapi';

const { schema: navigatorImportRequestSchema } = await resolver(
  navigatorImportSchema
).toOpenAPISchema();

type NavigatorDeleteTx = Pick<typeof db, 'delete'>;
type TxOrDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type MovedLessonRoom = { id: string; room: string | null };

/**
 * Delete navigator rows in FK-safe order. The navigator-only tables always go
 * first; when `clearAll`, the timetable-shared tables are wiped too. Classrooms
 * go before their parents: `classroom.building_id` → building is NO ACTION and
 * `classroom.type_id` → classroom_type is RESTRICT.
 */
async function wipeNavigatorTables(tx: NavigatorDeleteTx, clearAll: boolean) {
  await tx.delete(navigatorCorridor);
  await tx.delete(navigatorLift);
  await tx.delete(navigatorStair);
  await tx.delete(navigatorTranslation);

  if (clearAll) {
    await tx.delete(classroomTable);
    await tx.delete(classroomTypeTable);
    await tx.delete(buildingTable);
  }
}

/**
 * The moved_lesson.room FK is NO ACTION, so `DELETE FROM classroom` aborts
 * with 23503 whenever a moved lesson still points at a room. Lift those links
 * first (remembering them) so the wipe can proceed; the caller restores the
 * ones whose room survives the import afterwards. A merge never deletes the
 * shared tables, so this dance is only needed for `clearAll`.
 */
async function liftMovedLessonRooms(
  tx: TxOrDb,
  clearAll: boolean
): Promise<MovedLessonRoom[]> {
  if (!clearAll) {
    return [];
  }
  const rows = await tx
    .select({ id: movedLesson.id, room: movedLesson.room })
    .from(movedLesson)
    .where(isNotNull(movedLesson.room));
  await tx
    .update(movedLesson)
    .set({ room: null })
    .where(isNotNull(movedLesson.room));
  return rows;
}

/** Re-link the lifted moved lessons whose room is still in the payload. */
async function restoreMovedLessonRooms(
  tx: TxOrDb,
  movedLessonRooms: MovedLessonRoom[],
  keptRoomIds: Set<string>
) {
  for (const row of movedLessonRooms) {
    if (row.room !== null && keptRoomIds.has(row.room)) {
      await tx
        .update(movedLesson)
        .set({ room: row.room })
        .where(eq(movedLesson.id, row.id));
    }
  }
}

/**
 * lesson.classroom_ids and cohort.classroom_ids are unconstrained text[]; drop
 * any id the import removed so nothing points at a deleted room. Plain SQL
 * against the freshly-inserted classroom table, no parameters needed.
 */
async function dropDanglingRoomRefs(tx: TxOrDb) {
  await tx.execute(sql`
    UPDATE lesson
    SET classroom_ids = ARRAY(
      SELECT e FROM unnest(classroom_ids) AS e
      WHERE EXISTS (SELECT 1 FROM classroom c WHERE c.id = e)
    )
    WHERE classroom_ids IS NOT NULL
      AND classroom_ids <> ARRAY(
        SELECT e FROM unnest(classroom_ids) AS e
        WHERE EXISTS (SELECT 1 FROM classroom c WHERE c.id = e)
      )
  `);
  await tx.execute(sql`
    UPDATE cohort
    SET classroom_ids = ARRAY(
      SELECT e FROM unnest(classroom_ids) AS e
      WHERE EXISTS (SELECT 1 FROM classroom c WHERE c.id = e)
    )
    WHERE classroom_ids IS NOT NULL
      AND classroom_ids <> ARRAY(
        SELECT e FROM unnest(classroom_ids) AS e
        WHERE EXISTS (SELECT 1 FROM classroom c WHERE c.id = e)
      )
  `);
}

/**
 * Insert the navigator-only collections. These tables were just emptied (or a
 * merge is adding to them), so plain inserts preserve the file's ids.
 * Translations carry a natural (lang_key, text_key) key, so they upsert
 * defensively even though the table is now empty.
 */
async function insertNavigatorOnlyTables(
  tx: TxOrDb,
  payload: NavigatorTransfer
) {
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
    await tx
      .insert(navigatorTranslation)
      .values(payload.translations)
      .onConflictDoUpdate({
        set: { text: sql`excluded.text` },
        target: [navigatorTranslation.lang_key, navigatorTranslation.text_key],
      });
  }
}

export const exportNavigatorRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit NavigatorTransfer', true),
    description:
      'Export every navigator row (buildings, classroom types, classrooms, corridors, lifts, stairs and translations) as a versioned JSON payload.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(navigatorTransferResponseSchema),
          },
        },
        description: 'Navigator export payload',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  async (c) => {
    // Read every collection from one repeatable-read snapshot so the export
    // payload cannot straddle a concurrent import/write halfway through.
    const payload = await db.transaction(
      async (tx) => {
        const [
          buildings,
          classroomTypes,
          classrooms,
          corridors,
          lifts,
          stairs,
          translations,
        ] = await Promise.all([
          tx.select().from(buildingTable).orderBy(asc(buildingTable.name)),
          tx
            .select()
            .from(classroomTypeTable)
            .orderBy(asc(classroomTypeTable.name)),
          tx
            .select()
            .from(classroomTable)
            .orderBy(asc(classroomTable.name), asc(classroomTable.building_id)),
          tx
            .select()
            .from(navigatorCorridor)
            .orderBy(asc(navigatorCorridor.name)),
          tx.select().from(navigatorLift).orderBy(asc(navigatorLift.name)),
          tx.select().from(navigatorStair).orderBy(asc(navigatorStair.name)),
          tx
            .select()
            .from(navigatorTranslation)
            .orderBy(
              asc(navigatorTranslation.lang_key),
              asc(navigatorTranslation.text_key)
            ),
        ]);

        // Zod reorders the output to the transfer schema's shape (version
        // first) and drops nothing extra: the omit()s already removed the
        // timestamps.
        return navigatorTransferSchema.parse({
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
      },
      { isolationLevel: 'repeatable read' }
    );

    return ok(c, payload);
  }
);

export const importNavigatorRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit NavigatorImport', true),
    description:
      'Replace navigator-only tables with the contents of a navigator export payload and upsert the timetable-shared building/classroom/classroom-type rows, all inside one transaction.',
    parameters: [
      {
        in: 'query',
        name: 'clear',
        required: false,
        schema: {
          description:
            'When "true", wipe all navigator data (buildings, classroom types, classrooms, corridors, lifts, stairs, translations) before importing.',
          enum: ['true', 'false'],
          type: 'string',
        },
      },
    ],
    requestBody: {
      content: {
        'application/json': {
          schema: navigatorImportRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(navigatorImportResponseSchema),
          },
        },
        description: 'Import result with per-collection row counts',
      },
      400: { description: 'Invalid navigator export payload' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', navigatorImportSchema),
  zValidator('query', importQuerySchema),
  async (c) => {
    const payload = c.req.valid('json');
    const { clear } = c.req.valid('query');
    const clearAll = clear === 'true';

    try {
      await db.transaction(async (tx) => {
        const movedLessonRooms = await liftMovedLessonRooms(tx, clearAll);

        await wipeNavigatorTables(tx, clearAll);

        // Upsert parents before children. The timetable-shared tables are
        // never deleted: on conflict we overwrite every data column with the
        // file's value (audit timestamps are intentionally left untouched), so
        // the round-trip is lossless for ids and FKs.
        if (payload.classroomTypes.length > 0) {
          await tx
            .insert(classroomTypeTable)
            .values(payload.classroomTypes)
            .onConflictDoUpdate({
              set: {
                colorhex: sql`excluded.colorhex`,
                name: sql`excluded.name`,
              },
              target: classroomTypeTable.id,
            });
        }

        if (payload.buildings.length > 0) {
          await tx
            .insert(buildingTable)
            .values(payload.buildings)
            .onConflictDoUpdate({
              set: {
                description: sql`excluded.description`,
                mapped: sql`excluded.mapped`,
                name: sql`excluded.name`,
                x: sql`excluded.x`,
                y: sql`excluded.y`,
              },
              target: buildingTable.id,
            });
        }

        if (payload.classrooms.length > 0) {
          await tx
            .insert(classroomTable)
            .values(payload.classrooms)
            .onConflictDoUpdate({
              set: {
                building_id: sql`excluded.building_id`,
                capacity: sql`excluded.capacity`,
                description: sql`excluded.description`,
                mapped: sql`excluded.mapped`,
                name: sql`excluded.name`,
                rotation: sql`excluded.rotation`,
                short: sql`excluded.short`,
                size_x: sql`excluded.size_x`,
                size_y: sql`excluded.size_y`,
                size_z: sql`excluded.size_z`,
                storey: sql`excluded.storey`,
                type_id: sql`excluded.type_id`,
                x: sql`excluded.x`,
                y: sql`excluded.y`,
              },
              target: classroomTable.id,
            });
        }

        // Navigator-only tables were just emptied; plain inserts preserve the
        // file's ids.
        await insertNavigatorOnlyTables(tx, payload);

        if (clearAll) {
          const keptRoomIds = new Set(
            payload.classrooms.map((classroom) => classroom.id)
          );
          await restoreMovedLessonRooms(tx, movedLessonRooms, keptRoomIds);
          await dropDanglingRoomRefs(tx);
        }
      });
    } catch (err) {
      // A malformed payload surfaces as a Postgres integrity-constraint
      // violation (SQLSTATE class 23: unique, foreign-key, not-null, check).
      // The transaction rolls back, so nothing is left half-applied.
      if (isIntegrityViolation(err)) {
        throw badRequest('Navigator import payload is invalid', err);
      }
      throw err;
    }

    return ok(c, {
      buildings: payload.buildings.length,
      classrooms: payload.classrooms.length,
      classroomTypes: payload.classroomTypes.length,
      corridors: payload.corridors.length,
      lifts: payload.lifts.length,
      stairs: payload.stairs.length,
      translations: payload.translations.length,
    });
  }
);
