import type { MovedLessonItem } from '@/hooks/moved-lessons';
import type { SubstitutionItem } from '@/hooks/substitutions';
import {
  formatIsoDateOnly,
  formatShortWeekday,
  getLocalizedWeekdayName,
} from '@/utils/date-locale';
import type { FilterType, LessonItem } from './types';

export type LessonOverlayTone = 'cancelled' | 'substitution' | 'moved';

/**
 * One timetable change on the concrete date it applies to. Labels are
 * translated once by the page data hook so every renderer gets plain strings.
 */
export type LessonOverlay = {
  /** Localized short weekday, so a week's worth of changes stays unambiguous. */
  day: string;
  /** Full line for the hover popover. */
  detail: string;
  /** Source substitution/moved-lesson id; also a stable React key. */
  id: string;
  /** Compact label that fits a split grid card. */
  label: string;
  tone: LessonOverlayTone;
};

/** Timetable changes keyed by the id of the affected lesson. */
export type LessonOverlayLookup = Map<string, LessonOverlay[]>;

/** Moved lessons use a bright amber, independent of the active theme token. */
export const MOVED_OVERLAY_BADGE_CLASS = 'bg-[#ffb900] px-1 text-black';
export const MOVED_OVERLAY_RING_CLASS = 'ring-[#ffb900]/60';
export const MOVED_OVERLAY_SOFT_CLASS = 'bg-[#ffb900]/15';

export const overlayTextClass = (tone: LessonOverlayTone): string => {
  if (tone === 'cancelled') {
    return 'text-destructive';
  }
  if (tone === 'moved') {
    return 'text-[#ffb900]';
  }
  return 'text-primary';
};

/** Cancellations outrank substitutions, which outrank plain moves. */
export const dominantOverlayTone = (
  overlays?: LessonOverlay[]
): LessonOverlayTone | undefined => {
  if (!overlays?.length) {
    return undefined;
  }
  if (overlays.some((overlay) => overlay.tone === 'cancelled')) {
    return 'cancelled';
  }
  if (overlays.some((overlay) => overlay.tone === 'substitution')) {
    return 'substitution';
  }
  return 'moved';
};

type Translator = (
  key: string,
  options?: { name?: string; target?: string }
) => string;

/** Monday–Friday of the week containing `date`, as local `YYYY-MM-DD` keys. */
function getSchoolWeekDates(date: Date): Set<string> {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const dates = new Set<string>();
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + dayOffset);
    dates.add(formatIsoDateOnly(day));
  }
  return dates;
}

const formatChangeDay = (date: Date, language: string | undefined): string =>
  formatShortWeekday(date, language);

/** Where the lesson actually takes place: weekday, period and target room. */
function formatMoveTarget(
  item: MovedLessonItem,
  language: string | undefined,
  t: Translator
): string {
  const day = item.dayDefinition
    ? getLocalizedWeekdayName(
        item.dayDefinition.name,
        item.dayDefinition.short,
        language,
        'short'
      )
    : '';
  const period = item.period
    ? `${item.period.period}. ${t('substitution.period')}`
    : '';
  const room = item.classroom
    ? item.classroom.short || item.classroom.name || ''
    : '';

  return [day, period, room].filter(Boolean).join(' ');
}

const isInWeek = (date: Date, weekDates: Set<string>): boolean =>
  weekDates.has(formatIsoDateOnly(date));

function substitutionOverlay(
  item: SubstitutionItem,
  language: string | undefined,
  t: Translator
): LessonOverlay {
  const cancelled = item.teacher === null;
  const fullName = item.teacher
    ? [item.teacher.firstName, item.teacher.lastName].filter(Boolean).join(' ')
    : '';
  const name = item.teacher?.short || fullName || t('unknown');

  return {
    day: formatChangeDay(item.substitution.date, language),
    detail: cancelled
      ? t('substitution.cancelled')
      : t('timetable.substitutedBy', { name }),
    id: item.substitution.id,
    label: cancelled ? t('substitution.cancelled') : `→ ${name}`,
    tone: cancelled ? 'cancelled' : 'substitution',
  };
}

function movedLessonOverlay(
  item: MovedLessonItem,
  language: string | undefined,
  t: Translator
): LessonOverlay {
  const target = formatMoveTarget(item, language, t);

  return {
    day: formatChangeDay(item.movedLesson.date, language),
    detail: target
      ? t('timetable.movedTo', { target })
      : t('movedLesson.moved'),
    id: item.movedLesson.id,
    label: target ? `→ ${target}` : t('movedLesson.moved'),
    tone: 'moved',
  };
}

/** Original weekday, period and rooms of a move, for the target-room card. */
function formatMoveSource(
  item: MovedLessonItem,
  language: string | undefined,
  t: Translator
): string {
  const source = item.lessons.find((lesson) => lesson !== null) ?? null;
  const day = source?.day
    ? getLocalizedWeekdayName(
        source.day.name,
        source.day.short,
        language,
        'short'
      )
    : '';
  const period = source?.period
    ? `${source.period.period}. ${t('substitution.period')}`
    : '';
  const rooms = new Set<string>();
  for (const lesson of item.lessons) {
    if (lesson) {
      for (const room of lesson.classrooms) {
        rooms.add(room.short || room.name);
      }
    }
  }
  if (item.manual?.sourceRoom) {
    rooms.add(item.manual.sourceRoom.short || item.manual.sourceRoom.name);
  }

  return [day, period, Array.from(rooms).filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' ');
}

/** The overlay hung on a card rendered at a move's *target* room and slot. */
function movedInOverlay(
  item: MovedLessonItem,
  language: string | undefined,
  t: Translator
): LessonOverlay {
  const source = formatMoveSource(item, language, t);

  return {
    day: formatChangeDay(item.movedLesson.date, language),
    detail: source
      ? t('timetable.movedHereFrom', { target: source })
      : t('movedLesson.moved'),
    id: item.movedLesson.id,
    label: t('movedLesson.moved'),
    tone: 'moved',
  };
}

function addForLessons(
  lookup: LessonOverlayLookup,
  lessons: readonly { id: string }[],
  overlay: LessonOverlay
): void {
  for (const lesson of lessons) {
    const existing = lookup.get(lesson.id);
    if (existing) {
      existing.push(overlay);
      continue;
    }
    lookup.set(lesson.id, [overlay]);
  }
}

/**
 * Build the lookup for the school week containing the selected date. Both
 * public lists carry the same enriched lessons as the timetable endpoints, so
 * the lesson id is the exact join key — no backend change is needed.
 */
export function buildLessonOverlayLookup(
  substitutions: SubstitutionItem[] | undefined,
  movedLessons: MovedLessonItem[] | undefined,
  selectedDate: Date,
  language: string | undefined,
  t: Translator
): LessonOverlayLookup {
  const weekDates = getSchoolWeekDates(selectedDate);
  const lookup: LessonOverlayLookup = new Map();

  for (const item of substitutions ?? []) {
    if (isInWeek(item.substitution.date, weekDates)) {
      addForLessons(
        lookup,
        item.lessons,
        substitutionOverlay(item, language, t)
      );
    }
  }

  for (const item of movedLessons ?? []) {
    if (isInWeek(item.movedLesson.date, weekDates)) {
      addForLessons(
        lookup,
        item.lessons,
        movedLessonOverlay(item, language, t)
      );
    }
  }

  return lookup;
}

type OverlayExtrasParams = {
  activeFilter: FilterType;
  activeSelectionId: string | null;
  language: string | undefined;
  movedLessons?: MovedLessonItem[];
  selectedDate: Date;
  substitutions?: SubstitutionItem[];
  t: Translator;
};

type OverlayExtras = {
  lessons: LessonItem[];
  overlays: LessonOverlayLookup;
};

type ExtraBuilderParams = {
  extras: OverlayExtras;
  language: string | undefined;
  selectionId: string;
  t: Translator;
  weekDates: Set<string>;
};

const createExtras = (): OverlayExtras => ({
  lessons: [],
  overlays: new Map(),
});

const addExtraLesson = (
  extras: OverlayExtras,
  lesson: LessonItem,
  overlay: LessonOverlay
): void => {
  extras.lessons.push(lesson);
  extras.overlays.set(lesson.id, [overlay]);
};

const toLessonRef = (value: { id: string; name: string; short: string }) => ({
  id: value.id,
  name: value.name,
  short: value.short,
});

const toLessonPeriod = (
  period: MovedLessonItem['period']
): LessonItem['period'] =>
  period
    ? {
        endTime: period.endTime,
        id: period.id,
        period: period.period,
        startTime: period.startTime,
      }
    : null;

/** A substitute teacher is not part of the original lesson's `teachers`. */
function addSubstituteExtras(
  item: SubstitutionItem,
  params: ExtraBuilderParams
): void {
  const substitute = item.teacher;
  if (!substitute || substitute.id !== params.selectionId) {
    return;
  }
  if (!isInWeek(item.substitution.date, params.weekDates)) {
    return;
  }

  const overlay = substitutionOverlay(item, params.language, params.t);

  for (const lesson of item.lessons) {
    // The substituter is sometimes also one of the original teachers; then
    // the real card already carries the overlay.
    if (
      lesson.teachers.some(
        (lessonTeacher) => lessonTeacher.id === params.selectionId
      )
    ) {
      continue;
    }
    addExtraLesson(
      params.extras,
      {
        ...lesson,
        id: `substitute:${item.substitution.id}:${lesson.id}`,
      },
      overlay
    );
  }
}

/** A move's target room is not part of the original lesson's `classrooms`. */
function addMoveTargetExtras(
  item: MovedLessonItem,
  params: ExtraBuilderParams
): void {
  const { classroom, dayDefinition, manual, movedLesson, period, lessons } =
    item;
  if (!(dayDefinition && period)) {
    return;
  }
  if (!isInWeek(movedLesson.date, params.weekDates)) {
    return;
  }

  // A room-only move names its target room; a slot-only move keeps the
  // lesson's own rooms, so either way the card belongs to the target slot.
  const targetMatchesSelection = classroom
    ? classroom.id === params.selectionId
    : lessons.some((lesson) =>
        lesson.classrooms.some((room) => room.id === params.selectionId)
      );
  if (!targetMatchesSelection) {
    return;
  }

  const overlay = movedInOverlay(item, params.language, params.t);

  for (const lesson of lessons) {
    const classrooms = classroom ? [toLessonRef(classroom)] : lesson.classrooms;
    const sameSlot =
      lesson.day?.id === dayDefinition.id && lesson.period?.id === period.id;
    // The room's own recurring card already sits in this cell and carries the
    // move overlay; a second card would duplicate it.
    if (
      sameSlot &&
      lesson.classrooms.some((room) => room.id === params.selectionId)
    ) {
      continue;
    }
    addExtraLesson(
      params.extras,
      {
        ...lesson,
        classrooms,
        day: dayDefinition,
        id: `move-target:${movedLesson.id}:${lesson.id}`,
        period: toLessonPeriod(period),
      },
      overlay
    );
  }

  // A manual move has no linked lesson id, so only its metadata can place a
  // card on the target room's timetable.
  if (lessons.length > 0 || !manual) {
    return;
  }
  addExtraLesson(
    params.extras,
    {
      classrooms: classroom ? [toLessonRef(classroom)] : [],
      cohorts: manual.cohorts,
      day: dayDefinition,
      groups: [],
      groupsIds: [],
      id: `move-manual-target:${movedLesson.id}`,
      period: toLessonPeriod(period),
      periodsPerWeek: 1,
      subject: manual.subject,
      teachers: manual.teachers,
      termDefinitionId: null,
      weekDefinition: null,
      weeksDefinitionId: '',
    },
    overlay
  );
}

/**
 * Changes whose affected entity is *not* one of the linked lesson's stored
 * teachers/classrooms. `buildLessonOverlayLookup` can only key on the original
 * lesson id; a substitute teacher and a move's target room never appear in
 * that lesson's arrays, so their timetable needs an extra card to hang the
 * change on. Cards for the original teacher and source room already exist.
 */
export function buildOverlayLessonExtras(
  params: OverlayExtrasParams
): OverlayExtras {
  const extras = createExtras();
  const selectionId = params.activeSelectionId;
  if (!selectionId) {
    return extras;
  }

  const shared: ExtraBuilderParams = {
    extras,
    language: params.language,
    selectionId,
    t: params.t,
    weekDates: getSchoolWeekDates(params.selectedDate),
  };

  if (params.activeFilter === 'teacher') {
    for (const item of params.substitutions ?? []) {
      addSubstituteExtras(item, shared);
    }
  }

  if (params.activeFilter === 'classroom') {
    for (const item of params.movedLessons ?? []) {
      addMoveTargetExtras(item, shared);
    }
  }

  return extras;
}
