import type { EmailDetail } from '@filcdev/mail';
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

function movedLessonContentHu(
  p: {
    room?: string | null;
    startingDay?: string | null;
    startingPeriod?: string | null;
  },
  multiple: boolean
): string {
  const roomPart = p.room ? `, ${p.room} terem` : '';
  const dayPart = p.startingDay ? dayName(p.startingDay, 'hu') : '';
  const periodPart = p.startingPeriod
    ? periodLabel(p.startingPeriod, 'hu')
    : '';
  const timePart = [dayPart, periodPart].filter(Boolean).join(', ');
  const suffix = multiple
    ? ' Nézd meg az órarendedben a további változásokat!'
    : '';
  const location = timePart
    ? `${timePart}${roomPart}`
    : `másik időpontra${roomPart ? ` (${roomPart.slice(2)})` : ''}`;
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
  const roomPart = p.room ? ` in room ${p.room}` : '';
  const dayPart = p.startingDay ? dayName(p.startingDay, 'en') : '';
  const periodPart = p.startingPeriod
    ? periodLabel(p.startingPeriod, 'en')
    : '';
  const atPart =
    dayPart && periodPart ? `${dayPart}, ${periodPart}` : dayPart || periodPart;
  const suffix = multiple ? ' Check your timetable for all updates.' : '';
  const location = atPart
    ? `${atPart}${roomPart}`
    : `a new time slot${roomPart ? ` (${roomPart.slice(1)})` : ''}`;
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

/** Everything `buildMovedLessonDetails` reads off a moved lesson. */
export type MovedLessonDetailsPayload = {
  cohortNames: string[];
  comment?: string | null;
  date: Date;
  original: {
    day?: string | null;
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

/** Structured label/value rows for the `moved_lesson` email. */
export function buildMovedLessonDetails(
  payload: MovedLessonDetailsPayload,
  locale: string
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

  const location = (
    day: string | null | undefined,
    period: number | null | undefined,
    room: string | null | undefined
  ): string =>
    [
      day ? dayName(day, locale) : '',
      period == null ? '' : periodLabel(String(period), locale),
      room ?? '',
    ]
      .filter(Boolean)
      .join(', ');

  const rows: EmailDetail[] = [
    { label: label.date, value: formatDate(date, locale) },
    { label: label.class, value: cohortNames.join(', ') },
    { label: label.subject, value: subjectNames.join(', ') },
    {
      label: label.original,
      value: location(original.day, original.period, original.room),
    },
    {
      label: label.target,
      value: location(target.day, target.period, target.room),
    },
    { label: label.teacher, value: original.teacherNames.join(', ') },
    { label: label.comment, value: comment?.trim() ?? '' },
  ];

  return rows.filter((row) => row.value.length > 0);
}

/** The complete moved-lesson notification, shared by the pipeline and preview. */
export function buildMovedLessonNotificationContent(
  payload: MovedLessonNotificationSource &
    MovedLessonDetailsPayload & { lessonIds?: string[] },
  locale: string
): NotificationContent {
  const { target } = payload;
  const highlights = [
    target.day ? dayName(target.day, locale) : '',
    target.period == null ? '' : periodLabel(String(target.period), locale),
    target.room ?? '',
  ]
    .filter(Boolean)
    .slice(0, 4);

  return {
    content: buildMovedLessonContent(payload, locale),
    details: buildMovedLessonDetails(payload, locale),
    highlights,
    title: isHungarianLocale(locale) ? 'Áthelyezett óra' : 'Moved Lesson',
  };
}

/**
 * The notifications the timetable owns. A substitution or a moved lesson goes
 * to the cohorts that own the affected lessons, the substitute is told what
 * they now cover, and a user whose cohort disappeared is asked to pick a new
 * one — that last one reaches a single addressed user and is not gated on a
 * notification preference.
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
