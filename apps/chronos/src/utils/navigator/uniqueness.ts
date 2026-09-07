import { and, eq, ne } from 'drizzle-orm';
import type { db } from '#database';
import {
  navigatorBuilding,
  navigatorClassroom,
  navigatorClassroomType,
  navigatorCorridor,
  navigatorLift,
  navigatorStair,
  navigatorTranslation,
} from '#database/schema/navigator';
import { conflict } from '#utils/http';

type DbExecutor = Pick<typeof db, 'select'>;

/**
 * Rethrow an unknown error, mapping a Postgres unique-violation (SQLSTATE
 * 23505) to a `409 Conflict` response. Used to guard `insert`/`update` calls
 * whose uniqueness is also pre-checked with a SELECT, so a concurrent write
 * racing past the pre-check still surfaces as a 409 instead of a 500.
 */
export const conflictOnUniqueViolation = (
  err: unknown,
  message: string
): never => {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  ) {
    throw conflict(message, err);
  }
  throw err;
};

export const assertBuildingNameUnique = async (
  executor: DbExecutor,
  name: string,
  excludeId?: string
) => {
  const conditions = [eq(navigatorBuilding.name, name)];
  if (excludeId) {
    conditions.push(ne(navigatorBuilding.id, excludeId));
  }

  const rows = await executor
    .select({ id: navigatorBuilding.id })
    .from(navigatorBuilding)
    .where(and(...conditions))
    .limit(1);

  if (rows.length > 0) {
    throw conflict('A building with this name already exists');
  }
};

export const assertClassroomTypeNameUnique = async (
  executor: DbExecutor,
  name: string,
  excludeId?: string
) => {
  const conditions = [eq(navigatorClassroomType.name, name)];
  if (excludeId) {
    conditions.push(ne(navigatorClassroomType.id, excludeId));
  }

  const rows = await executor
    .select({ id: navigatorClassroomType.id })
    .from(navigatorClassroomType)
    .where(and(...conditions))
    .limit(1);

  if (rows.length > 0) {
    throw conflict('A classroom type with this name already exists');
  }
};

export const assertClassroomNameUnique = async (
  executor: DbExecutor,
  name: string,
  buildingId: string,
  excludeId?: string
) => {
  const conditions = [
    eq(navigatorClassroom.name, name),
    eq(navigatorClassroom.buildingId, buildingId),
  ];
  if (excludeId) {
    conditions.push(ne(navigatorClassroom.id, excludeId));
  }

  const rows = await executor
    .select({ id: navigatorClassroom.id })
    .from(navigatorClassroom)
    .where(and(...conditions))
    .limit(1);

  if (rows.length > 0) {
    throw conflict(
      'A classroom with this name already exists in this building'
    );
  }
};

export const assertCorridorNameUnique = async (
  executor: DbExecutor,
  name: string,
  buildingId: string,
  excludeId?: string
) => {
  const conditions = [
    eq(navigatorCorridor.name, name),
    eq(navigatorCorridor.buildingId, buildingId),
  ];
  if (excludeId) {
    conditions.push(ne(navigatorCorridor.id, excludeId));
  }

  const rows = await executor
    .select({ id: navigatorCorridor.id })
    .from(navigatorCorridor)
    .where(and(...conditions))
    .limit(1);

  if (rows.length > 0) {
    throw conflict('A corridor with this name already exists in this building');
  }
};

export const assertLiftNameUnique = async (
  executor: DbExecutor,
  name: string,
  buildingId: string,
  excludeId?: string
) => {
  const conditions = [
    eq(navigatorLift.name, name),
    eq(navigatorLift.buildingId, buildingId),
  ];
  if (excludeId) {
    conditions.push(ne(navigatorLift.id, excludeId));
  }

  const rows = await executor
    .select({ id: navigatorLift.id })
    .from(navigatorLift)
    .where(and(...conditions))
    .limit(1);

  if (rows.length > 0) {
    throw conflict('A lift with this name already exists in this building');
  }
};

export const assertStairNameUnique = async (
  executor: DbExecutor,
  name: string,
  buildingId: string,
  excludeId?: string
) => {
  const conditions = [
    eq(navigatorStair.name, name),
    eq(navigatorStair.buildingId, buildingId),
  ];
  if (excludeId) {
    conditions.push(ne(navigatorStair.id, excludeId));
  }

  const rows = await executor
    .select({ id: navigatorStair.id })
    .from(navigatorStair)
    .where(and(...conditions))
    .limit(1);

  if (rows.length > 0) {
    throw conflict('A stair with this name already exists in this building');
  }
};

export const assertTranslationKeyUnique = async (
  executor: DbExecutor,
  langKey: string,
  textKey: string
) => {
  const rows = await executor
    .select({ langKey: navigatorTranslation.langKey })
    .from(navigatorTranslation)
    .where(
      and(
        eq(navigatorTranslation.langKey, langKey),
        eq(navigatorTranslation.textKey, textKey)
      )
    )
    .limit(1);

  if (rows.length > 0) {
    throw conflict(
      'A translation with this key already exists in this language'
    );
  }
};
