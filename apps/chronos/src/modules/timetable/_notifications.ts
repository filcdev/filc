import type { EmailDetail } from '@filcdev/mail';
import {
  type MovedLessonNotificationPayload,
  resolveMovedLessonTeacherAudience,
} from '#modules/timetable/utils/moved-lesson-notifications';
import { isMatchingWeekday } from '#modules/timetable/utils/weekday';
import { env } from '#utils/environment';
import {
  resolveAudienceForLessonChange,
  resolveAudienceForUser,
} from '#utils/notifications/engine';
import { isHungarianLocale } from '#utils/notifications/locale';
import {
  buildSubstitutionDetails,
  buildSubstitutionTeacherContent,
  resolveSubstituteTeacherAudience,
  type SubstitutionTeacherPayload,
  uniqueStrings,
} from '#utils/notifications/substitution-teacher';
import type {
  NotificationContent,
  NotificationHandler,
} from '#utils/notifications/types';

const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_NAMES_HU = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek'];
const WEEKDAY_NAMES_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const WEEKDAY_NAMES_HU = [
  'Vasárnap',
  'Hétfő',
  'Kedd',
  'Szerda',
  'Csütörtök',
  'Péntek',
  'Szombat',
];

function dayName(day: string, locale: string): string {
  const names = isHungarianLocale(locale) ? DAY_NAMES_HU : DAY_NAMES_EN;
  const num = Number.parseInt(day, 10);
  if (num >= 1 && num <= names.length) {
    return names[num - 1] ?? day;
  }

  // Day definitions store a localized name ("Szerda", "Hétfő"), not a number.
  // Match it against the shared weekday aliases and translate it for the
  // recipient's locale, so the EN email says "Wednesday" rather than "Szerda".
  for (let index = 0; index < WEEKDAY_NAMES_EN.length; index++) {
    if (isMatchingWeekday(index, day)) {
      const weekday = isHungarianLocale(locale)
        ? WEEKDAY_NAMES_HU[index]
        : WEEKDAY_NAMES_EN[index];
      return weekday ?? day;
    }
  }

  return day;
}

function formatDate(date: Date, locale: string): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const weekday = isHungarianLocale(locale)
    ? WEEKDAY_NAMES_HU[date.getDay()]
    : WEEKDAY_NAMES_EN[date.getDay()];
  if (isHungarianLocale(locale)) {
    return `${weekday}, ${year}. ${month}. ${day}.`;
  }
  return `${weekday}, ${year}-${month}-${day}`;
}

function substitutionContentHu(
  dateStr: string,
  subName: string,
  lessonCount: number
): string {
  const timetableCta = ' Nézd meg az órarendedben a részletekért!';
  if (subName && lessonCount > 0) {
    return `${subName} helyettesít ${dateStr}, ${lessonCount} órádat tartja meg.${lessonCount > 1 ? timetableCta : ''}`;
  }
  if (subName) {
    return `${subName} helyettesít ${dateStr}.${timetableCta}`;
  }
  if (lessonCount > 0) {
    return `Helyettesítés ${dateStr} — ${lessonCount} órádat érinti.${lessonCount > 1 ? timetableCta : ''}`;
  }
  return `Új helyettesítés ${dateStr}.${timetableCta}`;
}

function substitutionContentEn(
  dateStr: string,
  subName: string,
  lessonCount: number
): string {
  const timetableCta = ' Check your timetable for details.';
  if (subName && lessonCount > 0) {
    const lessonWord = lessonCount > 1 ? 'lessons' : 'lesson';
    return `${subName} is covering ${lessonCount} of your ${lessonWord} on ${dateStr}.${lessonCount > 1 ? timetableCta : ''}`;
  }
  if (subName) {
    return `${subName} will be covering your lesson(s) on ${dateStr}.${timetableCta}`;
  }
  if (lessonCount > 0) {
    const lessonWord = lessonCount > 1 ? 'lessons' : 'lesson';
    return `A substitution on ${dateStr} affects ${lessonCount} of your ${lessonWord}.${lessonCount > 1 ? timetableCta : ''}`;
  }
  return `A new substitution has been posted for ${dateStr}.${timetableCta}`;
}

export function buildSubstitutionContent(
  p: { date?: Date; lessonIds?: string[]; substituterName?: string | null },
  locale: string
): string {
  const date = p.date ? new Date(p.date) : null;
  const dateStr = date ? formatDate(date, locale) : '';
  const subName = p.substituterName ?? '';
  const lessonCount = p.lessonIds?.length ?? 0;
  return isHungarianLocale(locale)
    ? substitutionContentHu(dateStr, subName, lessonCount)
    : substitutionContentEn(dateStr, subName, lessonCount);
}

/**
 * The complete student-facing `substitution` notification: the one-sentence
 * body, the structured details and the title. Shared by the live pipeline and
 * the dev preview so both render the same thing.
 */
export function buildSubstitutionNotificationContent(
  payload: SubstitutionTeacherPayload & { lessonIds?: string[] },
  locale: string
): NotificationContent {
  const { lessons } = payload;
  const highlights = [
    ...uniqueStrings(
      lessons.map((entry) =>
        entry.period == null ? null : periodLabel(String(entry.period), locale)
      )
    ),
    ...uniqueStrings(lessons.flatMap((entry) => entry.rooms)),
  ].slice(0, 4);

  return {
    content: buildSubstitutionContent(payload, locale),
    details: buildSubstitutionDetails(payload, locale),
    highlights,
    title: isHungarianLocale(locale) ? 'Új helyettesítés' : 'New Substitution',
  };
}

function periodLabel(period: string, locale: string): string {
  return isHungarianLocale(locale) ? `${period}. óra` : `Period ${period}`;
}

/**
 * The prose form of a moved lesson's new slot: "csütörtök, 2. óra, 201 terem"
 * / "Thursday, Period 2, room 201". Unlike `movedLessonLocation` (the
 * detail-row format) the room reads as a room, not a bare number.
 */
function movedLessonProseLocation(
  p: {
    day?: string | null;
    period?: number | string | null;
    room?: string | null;
  },
  locale: string
): string {
  const hu = isHungarianLocale(locale);
  let roomPart = '';
  if (p.room) {
    roomPart = hu ? `, ${p.room} terem` : ` in room ${p.room}`;
  }
  const dayPart = p.day ? dayName(p.day, locale) : '';
  const periodPart =
    p.period == null ? '' : periodLabel(String(p.period), locale);
  const timePart = [dayPart, periodPart].filter(Boolean).join(', ');
  if (timePart) {
    return `${timePart}${roomPart}`;
  }
  return hu
    ? `másik időpontra${roomPart ? ` (${roomPart.slice(2)})` : ''}`
    : `a new time slot${roomPart ? ` (${roomPart.slice(1)})` : ''}`;
}

/** "Check your timetable" sentence for a move that changed more than one slot. */
function movedLessonMultipleSuffix(locale: string): string {
  return isHungarianLocale(locale)
    ? ' Nézd meg az órárendedben a további változásokat!'
    : ' Check your timetable for all updates.';
}

function movedLessonContentHu(
  p: {
    room?: string | null;
    startingDay?: string | null;
    startingPeriod?: string | null;
  },
  multiple: boolean
): string {
  const location = movedLessonProseLocation(
    { day: p.startingDay, period: p.startingPeriod, room: p.room },
    'hu'
  );
  const suffix = multiple ? movedLessonMultipleSuffix('hu') : '';
  return `Az órád át lett helyezve: ${location}.${suffix}`;
}

function movedLessonContentEn(
  p: {
    room?: string | null;
    startingDay?: string | null;
    startingPeriod?: string | null;
  },
  multiple: boolean
): string {
  const location = movedLessonProseLocation(
    { day: p.startingDay, period: p.startingPeriod, room: p.room },
    'en'
  );
  const suffix = multiple ? movedLessonMultipleSuffix('en') : '';
  return `Your lesson has been moved to ${location}.${suffix}`;
}

export type MovedLessonNotificationSource = {
  startingDay?: string | null;
  startingPeriod?: string | null;
  room?: string | null;
};

/** The one-sentence moved-lesson body, shared by the pipeline and the preview. */
export function buildMovedLessonContent(
  payload: MovedLessonNotificationSource & { lessonIds?: string[] },
  locale: string
): string {
  const multiple = (payload.lessonIds?.length ?? 0) > 1;
  return isHungarianLocale(locale)
    ? movedLessonContentHu(payload, multiple)
    : movedLessonContentEn(payload, multiple);
}

/** Everything the moved-lesson email builders read off a moved lesson. */
export type MovedLessonDetailsPayload = {
  cohortNames: string[];
  comment?: string | null;
  date: Date;
  original: {
    day?: string | null;
    /** The lessons started in more than one slot, so there is no single original. */
    hasMultipleSlots?: boolean;
    period?: number | null;
    room?: string | null;
    teacherNames: string[];
  };
  subjectNames: string[];
  target: {
    day?: string | null;
    period?: number | null;
    room?: string | null;
  };
};

/**
 * The shared detail rows of the moved-lesson emails. The teacher-facing mail
 * renders the same card minus the teacher row: the recipient is one of those
 * teachers, so the names say nothing new.
 */
function movedLessonDetails(
  payload: MovedLessonDetailsPayload,
  locale: string,
  includeTeacher: boolean
): EmailDetail[] {
  const hu = isHungarianLocale(locale);
  const { cohortNames, comment, date, original, subjectNames, target } =
    payload;

  const label = {
    class: hu ? 'Osztály' : 'Class',
    comment: hu ? 'Megjegyzés' : 'Comment',
    date: hu ? 'Dátum' : 'Date',
    original: hu ? 'Eredeti' : 'Original',
    subject: hu ? 'Tantárgy' : 'Subject',
    target: hu ? 'Új' : 'New',
    teacher: hu ? 'Tanár' : 'Teacher',
  };

  const rows: EmailDetail[] = [
    { label: label.date, value: formatDate(date, locale) },
    { label: label.class, value: cohortNames.join(', ') },
    { label: label.subject, value: subjectNames.join(', ') },
  ];

  // Only a day or a period makes an original slot worth showing: a manual move
  // knows at most a source room, and a multi-lesson move whose lessons started
  // in different slots has no single truthful one.
  if (original.day || original.period != null) {
    rows.push({
      label: label.original,
      value: movedLessonLocation(
        original.day,
        original.period,
        original.room,
        locale
      ),
    });
  }

  rows.push({
    label: label.target,
    value: movedLessonLocation(target.day, target.period, target.room, locale),
  });

  if (includeTeacher) {
    rows.push({
      label: label.teacher,
      value: original.teacherNames.join(', '),
    });
  }

  rows.push({ label: label.comment, value: comment?.trim() ?? '' });

  return rows.filter((row) => row.value.length > 0);
}

/** "csütörtök, 2. óra, 201" / "Thursday, Period 2, 201", omitting empty parts. */
function movedLessonLocation(
  day: string | null | undefined,
  period: number | null | undefined,
  room: string | null | undefined,
  locale: string
): string {
  return [
    day ? dayName(day, locale) : '',
    period == null ? '' : periodLabel(String(period), locale),
    room ?? '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** The hero chips of a moved lesson: the new day, period and room. */
function movedLessonTargetHighlights(
  target: MovedLessonDetailsPayload['target'],
  locale: string
): string[] {
  return [
    target.day ? dayName(target.day, locale) : '',
    target.period == null ? '' : periodLabel(String(target.period), locale),
    target.room ?? '',
  ]
    .filter(Boolean)
    .slice(0, 4);
}

/** The complete moved-lesson notification, shared by the pipeline and preview. */
export function buildMovedLessonNotificationContent(
  payload: MovedLessonNotificationSource &
    MovedLessonDetailsPayload & { lessonIds?: string[] },
  locale: string
): NotificationContent {
  const { target } = payload;

  return {
    content: buildMovedLessonContent(payload, locale),
    details: movedLessonDetails(payload, locale, true),
    highlights: movedLessonTargetHighlights(target, locale),
    title: isHungarianLocale(locale) ? 'Áthelyezett óra' : 'Moved Lesson',
  };
}

/**
 * The teacher-facing moved-lesson body: names the class and subject so a
 * teacher recognises which of their lessons moved, then the new slot. The
 * student body is written for a cohort ("your lesson has been moved") and
 * cannot be reused for the teacher.
 */
function buildMovedLessonTeacherContentText(
  payload: MovedLessonDetailsPayload,
  locale: string
): string {
  const hu = isHungarianLocale(locale);
  const className = payload.cohortNames.join(', ');
  const subject = payload.subjectNames.join(', ');
  const { target } = payload;
  const hasTarget =
    target.day != null || target.period != null || target.room != null;
  const location = movedLessonProseLocation(target, locale);
  const suffix = payload.original.hasMultipleSlots
    ? movedLessonMultipleSuffix(locale)
    : '';

  if (hu) {
    const who = [className ? `${className} osztály` : '', subject]
      .filter(Boolean)
      .join(' ');
    const lesson = who ? `A ${who} órád` : 'Az órád';
    const movedTo = hasTarget ? `: ${location}` : '';
    return `${lesson} áthelyezésre került${movedTo}.${suffix}`;
  }

  const who = [className, subject].filter(Boolean).join(' ');
  const lesson = who ? `Your ${who} lesson` : 'Your lesson';
  const movedTo = hasTarget ? ` to ${location}` : '';
  return `${lesson} was moved${movedTo}.${suffix}`;
}

/** The complete teacher-facing moved-lesson notification. */
export function buildMovedLessonTeacherContent(
  payload: MovedLessonDetailsPayload,
  locale: string
): NotificationContent {
  const hu = isHungarianLocale(locale);
  const className = payload.cohortNames.join(', ');
  const title = hu ? 'Az órád áthelyezve' : 'Your lesson was moved';

  return {
    content: buildMovedLessonTeacherContentText(payload, locale),
    details: movedLessonDetails(payload, locale, false),
    highlights: movedLessonTargetHighlights(payload.target, locale),
    title: className ? `${title} – ${className}` : title,
  };
}

/**
 * The notifications the timetable owns. A substitution or a moved lesson goes
 * to the cohorts that own the affected lessons, the substitute is told what
 * they now cover, the teachers of a moved lesson are told the same lesson
 * moved, and a user whose cohort disappeared is asked to pick a new one — that
 * last one reaches a single addressed user and is not gated on a notification
 * preference.
 */
export const timetableNotifications: readonly NotificationHandler[] = [
  {
    buildContent: (payload, locale) =>
      buildSubstitutionNotificationContent(
        payload as SubstitutionTeacherPayload & { lessonIds?: string[] },
        locale
      ),
    getAudience: (payload) => resolveAudienceForLessonChange(payload),
    getDelay: () => env.notificationDelaySubstitution,
    preferenceKey: 'substitution',
    type: 'substitution',
  },
  {
    buildContent: (payload, locale) =>
      buildSubstitutionTeacherContent(
        payload as SubstitutionTeacherPayload,
        locale
      ),
    getAudience: (payload) =>
      resolveSubstituteTeacherAudience(payload as SubstitutionTeacherPayload),
    getDelay: () => env.notificationDelaySubstitution,
    preferenceKey: 'substitution',
    type: 'substitution_teacher',
  },
  {
    buildContent: (payload, locale) =>
      buildMovedLessonNotificationContent(
        payload as MovedLessonDetailsPayload &
          MovedLessonNotificationSource & { lessonIds?: string[] },
        locale
      ),
    getAudience: (payload) => resolveAudienceForLessonChange(payload),
    getDelay: () => env.notificationDelayMovedLesson,
    preferenceKey: 'movedLesson',
    type: 'moved_lesson',
  },
  {
    buildContent: (payload, locale) =>
      buildMovedLessonTeacherContent(
        payload as MovedLessonDetailsPayload,
        locale
      ),
    getAudience: (payload) =>
      resolveMovedLessonTeacherAudience(
        payload as MovedLessonNotificationPayload
      ),
    getDelay: () => env.notificationDelayMovedLesson,
    preferenceKey: 'movedLesson',
    type: 'moved_lesson_teacher',
  },
  {
    buildContent: (payload, locale) => {
      const p = payload as { userId: string };
      const content = isHungarianLocale(locale)
        ? 'A csoportod már nem elérhető. Kérjük, válassz új csoportot a Beállítások menüben.'
        : 'Your cohort is no longer available. Please go to Settings to select a new cohort.';
      return {
        content,
        metadata: { action: 'cohort_reselection', userId: p.userId },
        title: isHungarianLocale(locale)
          ? 'Csoport újraválasztása szükséges'
          : 'Cohort Reselection Required',
      };
    },
    getAudience: (payload) => resolveAudienceForUser(payload),
    getDelay: () => 0,
    type: 'cohort_reselection_required',
  },
];
