import type { Classroom } from '@filcdev/api/domains/navigator/classroom';
import type { FullGraph } from '@filcdev/api/domains/navigator/graph';

/** Combining diacritical marks, stripped after NFD. */
const COMBINING_MARKS = /\p{Diacritic}/gu;

/** Resolves an entity codename to display text (`useKioskTranslations().t`). */
export type Translator = (
  key: string,
  options?: Record<string, unknown>
) => string;

/** Lowercase + strip diacritics so "Á" matches "a" (Hungarian-friendly). */
export function normalize(s: string): string {
  return s
    .toLocaleLowerCase('hu')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .trim();
}

/** A classroom plus the display strings the kiosk shows alongside it. */
export type ClassroomInfo = {
  buildingName: string;
  classroom: Classroom;
  /** Localized floor label, e.g. "2. emelet" / "Földszint". */
  floorLabel: string;
  typeColor: string;
  typeName: string;
};

/** Resolve a localized floor label for a storey number. */
export function storeyLabel(storey: number, t: Translator): string {
  if (storey === 0) {
    return t('ui.floor.ground');
  }

  if (storey < 0) {
    return t('ui.floor.basement', { n: Math.abs(storey) });
  }

  return t('ui.floor.upper', { n: storey });
}

/** Resolve the type/building/floor display info for a classroom. */
export function classroomInfo(
  graph: FullGraph,
  classroom: Classroom,
  t: Translator
): ClassroomInfo {
  const type = graph.classroom_types.find((ct) => ct.id === classroom.type_id);
  const building = graph.buildings.find((b) => b.id === classroom.building_id);

  return {
    buildingName: building ? t(building.name) : '?',
    classroom,
    floorLabel: storeyLabel(classroom.storey, t),
    typeColor: type?.colorhex || '#888888',
    typeName: type ? t(type.name) : t('ui.common.unknown_type'),
  };
}

/**
 * Match classrooms by name OR description OR type name (accent/case
 * insensitive). An empty query returns every classroom. Names, descriptions
 * and type names are translated through `t` before matching so search works in
 * the kiosk's language.
 */
export function searchClassrooms(
  graph: FullGraph | null,
  query: string,
  t: Translator
): Classroom[] {
  const rooms = graph?.classrooms ?? [];
  const q = normalize(query);

  const values: Classroom[] = [];

  for (const classroom of rooms) {
    if (
      normalize(t(classroom.name)).includes(q) ||
      normalize(t(classroom.description)).includes(q)
    ) {
      values.push(classroom);
      continue;
    }

    if (
      graph &&
      normalize(classroomInfo(graph, classroom, t).typeName).includes(q)
    ) {
      values.push(classroom);
    }
  }

  return values;
}
