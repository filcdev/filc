/**
 * Import the campus model captured from the retired Navigator backend.
 *
 * Capture the inputs from the running backend before it is decommissioned:
 *
 *   curl -s http://10.0.7.253:8001/api/graph > graph.json
 *   curl -s http://10.0.7.253:8001/api/translations/available
 *   curl -s "http://10.0.7.253:8001/api/translations/lang?lang=hu"  # once per language
 *
 * The `graph` response is written to `<dir>/graph.json` as it is. The
 * per-language bundles become `<dir>/translations.json`, an array of
 * `{ lang_key, text_key, text }` rows where `text_key` is the codename and
 * `text` is the string the `lang` endpoint returned for it. Both endpoints are
 * public, so no Navigator credentials are needed.
 *
 * Then run, from `apps/chronos`:
 *
 *   bun --bun src/database/scripts/import-navigator.ts <dir>
 *
 * The capture names its entities with codenames. They are resolved here, once,
 * through the `hu` bundle, so the rows carry human names and need no
 * translation at runtime; what is left in `navigator_translation` is the
 * interface strings the kiosk renders through `t()`.
 *
 * The campus-only tables are converged in one transaction: rows the capture no
 * longer contains are deleted and everything else is upserted. The shared
 * `building`/`classroom` tables are upsert-only instead — they hold the
 * timetable's own rooms too — so re-running the script against the same capture
 * is a no-op and never removes a row the timetable owns.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fullGraphSchema } from '@filcdev/api/domains/navigator/graph';
import { translationSchema } from '@filcdev/api/domains/navigator/translation';
import { getLogger } from '@logtape/logtape';
import { and, notInArray, sql } from 'drizzle-orm';
import z from 'zod';
import { db, prepareDb } from '#database';
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
} from '#database/schema/timetable';
import { configureLogger } from '#utils/logger';

await configureLogger('chronos');

const logger = getLogger(['chronos', 'import-navigator']);

const [directory] = process.argv.slice(2);

if (!directory) {
  logger.error(
    'Usage: bun --bun src/database/scripts/import-navigator.ts <dir>'
  );
  process.exit(1);
}

/** Read and parse one JSON file out of the capture directory. */
const readJson = async (name: string) =>
  JSON.parse(await readFile(join(directory, name), 'utf8')) as unknown;

await prepareDb();

const graph = fullGraphSchema.parse(await readJson('graph.json'));
const translations = z
  .array(translationSchema)
  .parse(await readJson('translations.json'));

/** The Hungarian bundle, which is what campus names are resolved with. */
const huByKey = new Map(
  translations
    .filter((row) => row.lang_key === 'hu')
    .map((row) => [row.text_key, row.text])
);

/** A capture codename as the human name the shared tables carry. */
const toText = (codename: string) => huByKey.get(codename) ?? codename;

/** Every codename the capture uses for a campus entity. */
const entityCodenames = new Set([
  ...graph.buildings.flatMap((row) => [row.description, row.name]),
  ...graph.classroom_types.map((row) => row.name),
  ...graph.classrooms.flatMap((row) => [row.description, row.name]),
  ...graph.corridors.map((row) => row.name),
  ...graph.lifts.map((row) => row.name),
  ...graph.stairs.map((row) => row.name),
]);

// An entity's codename has already been resolved into its row, so only the
// remaining (interface) strings belong in the translation table.
const interfaceTranslations = translations.filter(
  (row) => !entityCodenames.has(row.text_key)
);

await db.transaction(async (tx) => {
  // Drop what the capture no longer contains, children before parents so the
  // foreign keys hold on the way out. The shared building/classroom tables are
  // not touched: the capture is not their owner.
  await tx.delete(navigatorCorridor).where(
    notInArray(
      navigatorCorridor.id,
      graph.corridors.map((row) => row.id)
    )
  );
  await tx.delete(navigatorLift).where(
    notInArray(
      navigatorLift.id,
      graph.lifts.map((row) => row.id)
    )
  );
  await tx.delete(navigatorStair).where(
    notInArray(
      navigatorStair.id,
      graph.stairs.map((row) => row.id)
    )
  );
  // A type a classroom still uses has to survive its absence from the capture:
  // the room pointing at it is the timetable's, not the campus's.
  await tx.delete(classroomTypeTable).where(
    and(
      notInArray(
        classroomTypeTable.id,
        graph.classroom_types.map((row) => row.id)
      ),
      sql`NOT EXISTS (SELECT 1 FROM ${classroomTable} WHERE ${classroomTable.type_id} = ${classroomTypeTable.id})`
    )
  );

  // Upsert parents before children.
  if (graph.classroom_types.length > 0) {
    await tx
      .insert(classroomTypeTable)
      .values(
        graph.classroom_types.map((row) => ({
          ...row,
          name: toText(row.name),
        }))
      )
      .onConflictDoUpdate({
        set: { colorhex: sql`excluded.colorhex`, name: sql`excluded.name` },
        target: classroomTypeTable.id,
      });
  }

  if (graph.buildings.length > 0) {
    await tx
      .insert(buildingTable)
      .values(
        graph.buildings.map((row) => ({
          ...row,
          description: toText(row.description),
          mapped: true,
          name: toText(row.name),
        }))
      )
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

  if (graph.classrooms.length > 0) {
    await tx
      .insert(classroomTable)
      .values(
        graph.classrooms.map((row) => ({
          building_id: row.building_id,
          capacity: row.capacity,
          description: toText(row.description),
          id: row.id,
          mapped: true,
          name: toText(row.name),
          rotation: row.rotation,
          size_x: row.size_x,
          size_y: row.size_y,
          size_z: row.size_z,
          storey: row.storey,
          type_id: row.type_id,
          x: row.x,
          y: row.y,
        }))
      )
      .onConflictDoUpdate({
        set: {
          building_id: sql`excluded.building_id`,
          capacity: sql`excluded.capacity`,
          description: sql`excluded.description`,
          mapped: sql`excluded.mapped`,
          name: sql`excluded.name`,
          rotation: sql`excluded.rotation`,
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

  if (graph.corridors.length > 0) {
    await tx
      .insert(navigatorCorridor)
      .values(
        graph.corridors.map((row) => ({ ...row, name: toText(row.name) }))
      )
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

  if (graph.lifts.length > 0) {
    await tx
      .insert(navigatorLift)
      .values(graph.lifts.map((row) => ({ ...row, name: toText(row.name) })))
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

  if (graph.stairs.length > 0) {
    await tx
      .insert(navigatorStair)
      .values(graph.stairs.map((row) => ({ ...row, name: toText(row.name) })))
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

  if (interfaceTranslations.length > 0) {
    await tx
      .insert(navigatorTranslation)
      .values(interfaceTranslations)
      .onConflictDoUpdate({
        set: { text: sql`excluded.text` },
        target: [navigatorTranslation.lang_key, navigatorTranslation.text_key],
      });
  }
});

logger.info(
  `Imported ${graph.buildings.length} buildings, ${graph.classroom_types.length} classroom types, ${graph.classrooms.length} classrooms, ${graph.corridors.length} corridors, ${graph.lifts.length} lifts, ${graph.stairs.length} stairs and ${interfaceTranslations.length} translations`
);
