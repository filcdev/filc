import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { building } from '#database/schema/timetable';

// Entities in this file keep upstream Navigator's snake_case field names as
// their TypeScript property names, so selected rows are already the wire shape
// (the kiosk and the 3D package consume those names verbatim). Their primary
// keys are text: the ids that come from the upstream import are preserved as
// they are, and new rows carry a `crypto.randomUUID()`.
//
// Rooms and buildings are not here: they live in the timetable's own `building`
// and `classroom` tables, which carry the campus columns too, and they hold
// human names rather than the upstream codenames.

/** A corridor segment on a storey; `x1`/`y1`–`x2`/`y2` is its centre line. */
export const navigatorCorridor = pgTable(
  'navigator_corridor',
  {
    barrier_free: boolean('barrier_free').notNull(),
    building_id: text('building_id')
      .notNull()
      .references(() => building.id, { onDelete: 'cascade' }),
    id: text('id').primaryKey(),
    is_outdoor: boolean('is_outdoor').notNull(),
    name: text('name').notNull(),
    storey: integer('storey').notNull(),
    width: doublePrecision('width').notNull(),
    x1: doublePrecision('x1').notNull(),
    x2: doublePrecision('x2').notNull(),
    y1: doublePrecision('y1').notNull(),
    y2: doublePrecision('y2').notNull(),
    ...timestamps,
  },
  (t) => [index('navigator_corridor_building_id_idx').on(t.building_id)]
);

/** A lift shaft connecting `min_storey`..`max_storey` in one building. */
export const navigatorLift = pgTable(
  'navigator_lift',
  {
    building_id: text('building_id')
      .notNull()
      .references(() => building.id, { onDelete: 'cascade' }),
    id: text('id').primaryKey(),
    max_storey: integer('max_storey').notNull(),
    min_storey: integer('min_storey').notNull(),
    name: text('name').notNull(),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    ...timestamps,
  },
  (t) => [index('navigator_lift_building_id_idx').on(t.building_id)]
);

/** A staircase: a lift shaft that also has an orientation. */
export const navigatorStair = pgTable(
  'navigator_stair',
  {
    building_id: text('building_id')
      .notNull()
      .references(() => building.id, { onDelete: 'cascade' }),
    id: text('id').primaryKey(),
    max_storey: integer('max_storey').notNull(),
    min_storey: integer('min_storey').notNull(),
    name: text('name').notNull(),
    rotation: doublePrecision('rotation').notNull(),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    ...timestamps,
  },
  (t) => [index('navigator_stair_building_id_idx').on(t.building_id)]
);

/**
 * One translated string: a codename (`text_key`) in one language. Campus
 * entities carry human names, so this table holds the interface strings the
 * kiosk renders through `t()`.
 */
export const navigatorTranslation = pgTable(
  'navigator_translation',
  {
    lang_key: text('lang_key').notNull(),
    text: text('text').notNull(),
    text_key: text('text_key').notNull(),
  },
  (t) => [primaryKey({ columns: [t.lang_key, t.text_key] })]
);

export const navigatorSchema = {
  navigatorCorridor,
  navigatorLift,
  navigatorStair,
  navigatorTranslation,
};
