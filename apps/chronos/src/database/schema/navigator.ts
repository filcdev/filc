import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  coordinate,
  count,
  dimension,
  measurement,
  rotation,
  shortText,
  storey,
  timestamps,
} from '#database/helpers';

export const navigatorBuilding = pgTable('navigator_building', {
  description: text('description').notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  x: coordinate('x').notNull(),
  y: coordinate('y').notNull(),
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
    capacity: count('capacity').notNull(),
    description: text('description').notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    rotation: rotation('rotation').notNull(),
    sizeX: dimension('size_x').notNull(),
    sizeY: dimension('size_y').notNull(),
    sizeZ: dimension('size_z').notNull(),
    storey: storey('storey').notNull(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => navigatorClassroomType.id, { onDelete: 'restrict' }),
    x: coordinate('x').notNull(),
    y: coordinate('y').notNull(),
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
    storey: storey('storey').notNull(),
    width: measurement('width').notNull(),
    x1: coordinate('x1').notNull(),
    x2: coordinate('x2').notNull(),
    y1: coordinate('y1').notNull(),
    y2: coordinate('y2').notNull(),
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
    maxStorey: storey('max_storey').notNull(),
    minStorey: storey('min_storey').notNull(),
    name: text('name').notNull(),
    x: coordinate('x').notNull(),
    y: coordinate('y').notNull(),
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
    maxStorey: storey('max_storey').notNull(),
    minStorey: storey('min_storey').notNull(),
    name: text('name').notNull(),
    rotation: rotation('rotation').notNull(),
    x: coordinate('x').notNull(),
    y: coordinate('y').notNull(),
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
    langKey: shortText('lang_key', 10).notNull(),
    text: text('text').notNull(),
    textKey: shortText('text_key', 190).notNull(),
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
