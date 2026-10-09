import { env } from '#utils/environment';
import {
  resolveAudienceForCohortReselection,
  resolveAudienceForLessonChange,
} from '#utils/notifications/engine';
import { isHungarianLocale } from '#utils/notifications/locale';
import {
  buildSubstitutionTeacherContent,
  resolveSubstituteTeacherAudience,
  type SubstitutionTeacherPayload,
} from '#utils/notifications/substitution-teacher';
import type { NotificationHandler } from '#utils/notifications/types';

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

function buildSubstitutionContent(
  p: { date?: Date; substituter?: string | null; lessonIds?: string[] },
  locale: string
): string {
  const date = p.date ? new Date(p.date) : null;
  const dateStr = date ? formatDate(date, locale) : '';
  const subName = p.substituter ?? '';
  const lessonCount = p.lessonIds?.length ?? 0;
  return isHungarianLocale(locale)
    ? substitutionContentHu(dateStr, subName, lessonCount)
    : substitutionContentEn(dateStr, subName, lessonCount);
}

function periodLabel(period: string, locale: string): string {
  return isHungarianLocale(locale) ? `${period}. óra` : `Period ${period}`;
}

function movedLessonContentHu(
  p: {
    room?: string;
    startingDay?: string;
    startingPeriod?: string;
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
    room?: string;
    startingDay?: string;
    startingPeriod?: string;
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

/**
 * The notifications the timetable owns. A substitution or a moved lesson goes
 * to the cohorts that own the affected lessons, the substitute is told what
 * they now cover, and a user whose cohort disappeared is asked to pick a new
 * one — that last one reaches a single addressed user and is not gated on a
 * notification preference.
 */
export const timetableNotifications: readonly NotificationHandler[] = [
  {
    buildContent: (payload, locale) => {
      const p = payload as {
        date?: Date;
        substituter?: string | null;
        lessonIds?: string[];
      };
      return {
        content: buildSubstitutionContent(p, locale),
        title: isHungarianLocale(locale)
          ? 'Új helyettesítés'
          : 'New Substitution',
      };
    },
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
    buildContent: (payload, locale) => {
      const p = payload as {
        date?: Date;
        lessonIds?: string[];
        room?: string;
        startingDay?: string;
        startingPeriod?: string;
      };
      const multiple = (p.lessonIds?.length ?? 0) > 1;
      const content = isHungarianLocale(locale)
        ? movedLessonContentHu(p, multiple)
        : movedLessonContentEn(p, multiple);
      return {
        content,
        title: isHungarianLocale(locale) ? 'Áthelyezett óra' : 'Moved Lesson',
      };
    },
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
    getAudience: (payload) => resolveAudienceForCohortReselection(payload),
    getDelay: () => 0,
    type: 'cohort_reselection_required',
  },
];
