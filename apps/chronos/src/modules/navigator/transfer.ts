import { permissions } from '@filcdev/api/permissions';
import { asc, sql } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import {
  navigatorCorridor,
  navigatorLift,
  navigatorStair,
  navigatorTranslation,
} from '#modules/navigator/schema';
import { isIntegrityViolation } from '#modules/navigator/utils/errors';
import {
  type NavigatorTransfer,
  navigatorImportSchema,
  navigatorTransferSchema,
} from '#modules/navigator/utils/transfer';
import {
  building as buildingTable,
  classroom as classroomTable,
  classroomType as classroomTypeTable,
} from '#modules/timetable/schema';
import { base } from '#orpc';
import { badRequest } from '#utils/http';

type TxOrDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Upsert the navigator-only collections by key. A re-import is idempotent:
 * rows present in the file are updated, rows missing from it are left
 * untouched, and new rows are inserted. Translations carry a natural
 * (lang_key, text_key) key, so they upsert on that pair.
 */
async function upsertNavigatorOnlyTables(
  tx: TxOrDb,
  payload: NavigatorTransfer
) {
  if (payload.corridors.length > 0) {
    await tx
      .insert(navigatorCorridor)
      .values(payload.corridors)
      .onConflictDoUpdate({
        set: {
          barrier_free: sql`excluded.barrier_free`,
          building_id: sql`excluded.building_id`,
          is_outdoor: sql`excluded.is_outdoor`,
          name: sql`excluded.name`,
          storey: sql`excluded.storey`,
          width: sql`excluded.width`,
          x1: sql`excluded.x1`,
          x2: sql`excluded.x2`,
          y1: sql`excluded.y1`,
          y2: sql`excluded.y2`,
        },
        target: navigatorCorridor.id,
      });
  }
  if (payload.lifts.length > 0) {
    await tx
      .insert(navigatorLift)
      .values(payload.lifts)
      .onConflictDoUpdate({
        set: {
          building_id: sql`excluded.building_id`,
          max_storey: sql`excluded.max_storey`,
          min_storey: sql`excluded.min_storey`,
          name: sql`excluded.name`,
          x: sql`excluded.x`,
          y: sql`excluded.y`,
        },
        target: navigatorLift.id,
      });
  }
  if (payload.stairs.length > 0) {
    await tx
      .insert(navigatorStair)
      .values(payload.stairs)
      .onConflictDoUpdate({
        set: {
          building_id: sql`excluded.building_id`,
          max_storey: sql`excluded.max_storey`,
          min_storey: sql`excluded.min_storey`,
          name: sql`excluded.name`,
          rotation: sql`excluded.rotation`,
          x: sql`excluded.x`,
          y: sql`excluded.y`,
        },
        target: navigatorStair.id,
      });
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

export const exportNavigatorRoute = base.navigator.export
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async () => {
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

    // The download is the file the import procedure accepts back: the same
    // pretty-printed JSON the admin UI used to build client-side.
    return new File(
      [JSON.stringify(payload, null, 2)],
      `navigator-export-${new Date().toISOString().slice(0, 10)}.json`,
      { type: 'application/json' }
    );
  });

export const importNavigatorRoute = base.navigator.import
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    // The upload is a navigator export file. A body that is not JSON and a
    // body that fails the transfer schema are both the caller's fault.
    let payload: NavigatorTransfer;
    try {
      payload = navigatorImportSchema.parse(
        JSON.parse(await input.file.text())
      );
    } catch (error) {
      throw badRequest('Navigator import payload is invalid', error);
    }

    try {
      await db.transaction(async (tx) => {
        // Upsert parents before children. On conflict we overwrite every data
        // column with the file's value (audit timestamps are intentionally
        // left untouched), so a re-import is idempotent and rows absent from
        // the file survive.
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

        await upsertNavigatorOnlyTables(tx, payload);
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

    return {
      buildings: payload.buildings.length,
      classrooms: payload.classrooms.length,
      classroomTypes: payload.classroomTypes.length,
      corridors: payload.corridors.length,
      lifts: payload.lifts.length,
      stairs: payload.stairs.length,
      translations: payload.translations.length,
    };
  });
