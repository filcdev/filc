import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';

export const navigatorBuilding = pgTable('navigator_building', {
  description: text('description').notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  x: smallint('x').notNull(),
  y: smallint('y').notNull(),
  ...timestamps,
});

export const navigatorClassroomType = pgTable('navigator_classroom_type', {
  colorhex: text('colorhex'),
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  ...timestamps,
});

export const navigatorClassroom = pgTable(
  'navigator_classroom',
  {
    buildingId: uuid('building_id')
      .notNull()
      .references(() => navigatorBuilding.id, { onDelete: 'cascade' }),
    capacity: integer('capacity').notNull(),
    description: text('description').notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    rotation: smallint('rotation').notNull(),
    sizeX: integer('size_x').notNull(),
    sizeY: integer('size_y').notNull(),
    sizeZ: integer('size_z').notNull(),
    storey: smallint('storey').notNull(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => navigatorClassroomType.id, { onDelete: 'restrict' }),
    x: smallint('x').notNull(),
    y: smallint('y').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('navigator_classroom_name_building_id_uidx').on(
      t.name,
      t.buildingId
    ),
    index('navigator_classroom_building_id_idx').on(t.buildingId),
    index('navigator_classroom_type_id_idx').on(t.typeId),
  ]
);

export const navigatorCorridor = pgTable(
  'navigator_corridor',
  {
    barrierFree: boolean('barrier_free').notNull().default(false),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => navigatorBuilding.id, { onDelete: 'cascade' }),
    id: uuid('id').primaryKey().defaultRandom(),
    isOutdoor: boolean('is_outdoor').notNull().default(false),
    name: text('name').notNull(),
    storey: smallint('storey').notNull(),
    width: doublePrecision('width').notNull(),
    x1: smallint('x1').notNull(),
    x2: smallint('x2').notNull(),
    y1: smallint('y1').notNull(),
    y2: smallint('y2').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('navigator_corridor_name_building_id_uidx').on(
      t.name,
      t.buildingId
    ),
  ]
);

export const navigatorLift = pgTable(
  'navigator_lift',
  {
    buildingId: uuid('building_id')
      .notNull()
      .references(() => navigatorBuilding.id, { onDelete: 'cascade' }),
    id: uuid('id').primaryKey().defaultRandom(),
    maxStorey: smallint('max_storey').notNull(),
    minStorey: smallint('min_storey').notNull(),
    name: text('name').notNull(),
    x: smallint('x').notNull(),
    y: smallint('y').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('navigator_lift_name_building_id_uidx').on(
      t.name,
      t.buildingId
    ),
    check('navigator_lift_storey_check', sql`min_storey <= max_storey`),
  ]
);

export const navigatorStair = pgTable(
  'navigator_stair',
  {
    buildingId: uuid('building_id')
      .notNull()
      .references(() => navigatorBuilding.id, { onDelete: 'cascade' }),
    id: uuid('id').primaryKey().defaultRandom(),
    maxStorey: smallint('max_storey').notNull(),
    minStorey: smallint('min_storey').notNull(),
    name: text('name').notNull(),
    rotation: smallint('rotation').notNull(),
    x: smallint('x').notNull(),
    y: smallint('y').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('navigator_stair_name_building_id_uidx').on(
      t.name,
      t.buildingId
    ),
    check('navigator_stair_storey_check', sql`min_storey <= max_storey`),
  ]
);

export const navigatorTranslation = pgTable(
  'navigator_translation',
  {
    langKey: varchar('lang_key', { length: 10 }).notNull(),
    text: text('text').notNull(),
    textKey: varchar('text_key', { length: 190 }).notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.langKey, t.textKey] })]
);

export const navigatorSchema = {
  navigatorBuilding,
  navigatorClassroom,
  navigatorClassroomType,
  navigatorCorridor,
  navigatorLift,
  navigatorStair,
  navigatorTranslation,
};
