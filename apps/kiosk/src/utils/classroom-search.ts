import type { Classroom } from '@filcdev/api/domains/navigator/classroom';
import type { FullGraph } from '@filcdev/api/domains/navigator/graph';

/** Combining diacritical marks, stripped after NFD. */
const COMBINING_MARKS = /\p{Diacritic}/gu;

/** Resolves an entity codename to display text (`useKioskTranslations().t`). */
export type Translator = (
  key: string,
  options?: Record<string, unknown>
) => string;

/**
 * Resolves a translation key to its text, or `fallback` when the key has no
 * row in the bundle/built-in strings (`useKioskTranslations().resolve`).
 * Unlike `t`, it never falls back to the key itself.
 */
export type Resolver = (key: string, fallback: string) => string;

/** Lowercase + strip diacritics so "Á" matches "a" (Hungarian-friendly). */
export function normalize(s: string): string {
  return s
    .toLocaleLowerCase('hu')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .trim();
}

/**
 * Turns an arbitrary human-readable string into an ASCII codename fragment
 * (replicating upstream's slug): strip accents, lowercase, collapse every
 * non-alphanumeric run into `_`, trim leading/trailing `_`, and fall back to
 * `x` when nothing is left.
 */
export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug.length > 0 ? slug : 'x';
}

/**
 * The translation codename a classroom description is stored under:
 * `classroom.desc.b<buildingId>.<slug(name)>` (the `<buildingId>` segment is
 * `'b' + building.id`, e.g. `classroom.desc.b1.a05`).
 */
export function classroomDescriptionKey(
  classroom: Classroom,
  buildingId: string
): string {
  return `classroom.desc.b${buildingId}.${slugify(classroom.name)}`;
}

/** A classroom plus the display strings the kiosk shows alongside it. */
export type ClassroomInfo = {
  buildingName: string;
  classroom: Classroom;
  /**
   * Resolved description: the bundle text for the derived
   * `classroom.desc.*` key when present, otherwise `classroom.description`,
   * otherwise ''.
   */
  description: string;
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

/**
 * Resolve the type/building/floor/description display info for a classroom.
 * The description follows the convention `classroom.desc.b<buildingId>.<slug>`
 * via `resolve`, so a bundle-only description (blank column) still renders.
 */
export function classroomInfo(
  graph: FullGraph,
  classroom: Classroom,
  t: Translator,
  resolve: Resolver
): ClassroomInfo {
  const type = graph.classroom_types.find((ct) => ct.id === classroom.type_id);
  const building = graph.buildings.find((b) => b.id === classroom.building_id);

  return {
    buildingName: building ? t(building.name) : '?',
    classroom,
    description: resolve(
      classroomDescriptionKey(classroom, classroom.building_id),
      classroom.description
    ),
    floorLabel: storeyLabel(classroom.storey, t),
    typeColor: type?.colorhex || '#888888',
    typeName: type ? t(type.name) : t('ui.common.unknown_type'),
  };
}

/**
 * Match classrooms by name OR resolved description OR type name (accent/case
 * insensitive). An empty query returns every classroom. Names and type names
 * are translated through `t`; descriptions are resolved through the derived
 * `classroom.desc.*` key (see {@link classroomDescriptionKey}) with the raw
 * `classroom.description` as fallback, so search works in the kiosk's language.
 */
export function searchClassrooms(
  graph: FullGraph | null,
  query: string,
  t: Translator,
  resolve: Resolver
): Classroom[] {
  const rooms = graph?.classrooms ?? [];
  const q = normalize(query);

  const values: Classroom[] = [];

  for (const classroom of rooms) {
    if (
      normalize(t(classroom.name)).includes(q) ||
      normalize(
        resolve(
          classroomDescriptionKey(classroom, classroom.building_id),
          classroom.description
        )
      ).includes(q)
    ) {
      values.push(classroom);
      continue;
    }

    if (
      graph &&
      normalize(classroomInfo(graph, classroom, t, resolve).typeName).includes(
        q
      )
    ) {
      values.push(classroom);
    }
  }

  return values;
}
