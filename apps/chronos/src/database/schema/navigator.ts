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
  measurement,
  shortText,
  smallInt,
  timestamps,
} from '#database/helpers';

export const navigatorBuilding = pgTable('navigator_building', {
  description: text('description').notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  x: smallInt('x').notNull(),
  y: smallInt('y').notNull(),
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
    capacity: smallInt('capacity').notNull(),
    description: text('description').notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    rotation: smallInt('rotation').notNull(),
    sizeX: smallInt('size_x').notNull(),
    sizeY: smallInt('size_y').notNull(),
    sizeZ: smallInt('size_z').notNull(),
    storey: smallInt('storey').notNull(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => navigatorClassroomType.id, { onDelete: 'restrict' }),
    x: smallInt('x').notNull(),
    y: smallInt('y').notNull(),
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

export const navigatorUtility = pgTable(
  'navigator_utility',
  {
    barrierFree: boolean('barrier_free'),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => navigatorBuilding.id, { onDelete: 'cascade' }),
    id: uuid('id').primaryKey().defaultRandom(),
    isOutdoor: boolean('is_outdoor'),
    kind: text('kind').notNull(),
    maxStorey: smallInt('max_storey'),
    minStorey: smallInt('min_storey'),
    name: text('name').notNull(),
    rotation: smallInt('rotation'),
    storey: smallInt('storey'),
    width: measurement('width'),
    x: smallInt('x'),
    x1: smallInt('x1'),
    x2: smallInt('x2'),
    y: smallInt('y'),
    y1: smallInt('y1'),
    y2: smallInt('y2'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('navigator_utility_name_building_id_kind_uidx').on(
      t.name,
      t.buildingId,
      t.kind
    ),
    index('navigator_utility_building_id_idx').on(t.buildingId),
    check(
      'navigator_utility_storey_check',
      sql`min_storey IS NULL OR max_storey IS NULL OR min_storey <= max_storey`
    ),
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
  navigatorTranslation,
  navigatorUtility,
};
