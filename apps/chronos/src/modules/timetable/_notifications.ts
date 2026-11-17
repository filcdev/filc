import {
  createTranslator,
  formatMailDateWithWeekday,
  type Locale,
  normalizeLocale,
  periodLabel,
  WEEKDAY_NAMES_EN,
  WEEKDAY_NAMES_HU,
} from '@filcdev/i18n';
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
import { uniqueStrings } from '#utils/notifications/strings';
import {
  buildSubstitutionDetails,
  buildSubstitutionTeacherContent,
  resolveSubstituteTeacherAudience,
  type SubstitutionTeacherPayload,
} from '#utils/notifications/substitution-teacher';
import type {
  NotificationContent,
  NotificationHandler,
} from '#utils/notifications/types';

function dayName(day: string, locale: Locale): string {
  const names = locale === 'en' ? WEEKDAY_NAMES_EN : WEEKDAY_NAMES_HU;
  const num = Number.parseInt(day, 10);
  if (num >= 1 && num <= 5) {
    return names[num] ?? day;
  }

  // Day definitions store a localized name ("Szerda", "Hétfő"), not a number.
  // Match it against the shared weekday aliases and translate it for the
  // recipient's locale, so the EN email says "Wednesday" rather than "Szerda".
  for (let index = 0; index < WEEKDAY_NAMES_EN.length; index++) {
    if (isMatchingWeekday(index, day)) {
      return names[index] ?? day;
    }
  }

  return day;
}

export function buildSubstitutionContent(
  p: { date?: Date; lessonIds?: string[]; substituterName?: string | null },
  locale: string
): string {
  const resolved = normalizeLocale(locale);
  const t = createTranslator(resolved);
  const date = p.date ? new Date(p.date) : null;
  const dateStr = date ? formatMailDateWithWeekday(date, resolved) : '';
  const subName = p.substituterName ?? '';
  const lessonCount = p.lessonIds?.length ?? 0;
  const cta = lessonCount > 1 ? ` ${t('substitution.cta')}` : '';

  if (subName && lessonCount > 0) {
    return `${t('substitution.coveringLessons', { count: lessonCount, date: dateStr, name: subName })}${cta}`;
  }
  if (subName) {
    return `${t('substitution.coveringYourLessons', { date: dateStr, name: subName })} ${t('substitution.cta')}`;
  }
  if (lessonCount > 0) {
    return `${t('substitution.affectedLessons', { count: lessonCount, date: dateStr })}${cta}`;
  }
  return `${t('substitution.newSubstitution', { date: dateStr })} ${t('substitution.cta')}`;
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
  const resolved = normalizeLocale(locale);
  const t = createTranslator(resolved);
  const { lessons } = payload;
  const highlights = [
    ...uniqueStrings(
      lessons.map((entry) =>
        entry.period == null ? null : periodLabel(entry.period, resolved)
      )
    ),
    ...uniqueStrings(lessons.flatMap((entry) => entry.rooms)),
  ].slice(0, 4);

  return {
    content: buildSubstitutionContent(payload, locale),
    details: buildSubstitutionDetails(payload, locale),
    highlights,
    title: t('substitution.title'),
  };
}

/**
 * The prose form of a moved lesson's new slot: "csütörtök, 2. óra, 201 terem"
 * / "Thursday, Period 2 in room 201". Unlike `movedLessonLocation` (the
 * detail-row format) the room reads as a room, not a bare number, and each
 * language's own `proseLocation` key decides how the two parts join — English
 * runs them together, Hungarian keeps the comma.
 */
function movedLessonProseLocation(
  p: {
    day?: string | null;
    period?: number | string | null;
    room?: string | null;
  },
  locale: Locale
): string {
  const t = createTranslator(locale);
  const dayPart = p.day ? dayName(p.day, locale) : '';
  const periodPart = p.period == null ? '' : periodLabel(p.period, locale);
  const timePart = [dayPart, periodPart].filter(Boolean).join(', ');
  if (timePart) {
    return p.room
      ? t('movedLesson.proseLocation', {
          room: t('movedLesson.inRoom', { room: p.room }),
          time: timePart,
        })
      : timePart;
  }
  return p.room
    ? t('movedLesson.newTimeSlotInRoom', { room: p.room })
    : t('movedLesson.newTimeSlot');
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
  const resolved = normalizeLocale(locale);
  const t = createTranslator(resolved);
  const multiple = (payload.lessonIds?.length ?? 0) > 1;
  const location = movedLessonProseLocation(
    {
      day: payload.startingDay,
      period: payload.startingPeriod,
      room: payload.room,
    },
    resolved
  );
  const suffix = multiple ? ` ${t('movedLesson.multipleSuffix')}` : '';
  return `${t('movedLesson.body', { location })}${suffix}`;
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
  locale: Locale,
  includeTeacher: boolean
): EmailDetail[] {
  const t = createTranslator(locale);
  const { cohortNames, comment, date, original, subjectNames, target } =
    payload;

  const rows: EmailDetail[] = [
    { label: t('labels.date'), value: formatMailDateWithWeekday(date, locale) },
    { label: t('labels.class'), value: cohortNames.join(', ') },
    { label: t('labels.subject'), value: subjectNames.join(', ') },
  ];

  // Only a day or a period makes an original slot worth showing: a manual move
  // knows at most a source room, and a multi-lesson move whose lessons started
  // in different slots has no single truthful one.
  if (original.day || original.period != null) {
    rows.push({
      label: t('labels.original'),
      value: movedLessonLocation(
        original.day,
        original.period,
        original.room,
        locale
      ),
    });
  }

  rows.push({
    label: t('labels.new'),
    value: movedLessonLocation(target.day, target.period, target.room, locale),
  });

  if (includeTeacher) {
    rows.push({
      label: t('labels.teacher'),
      value: original.teacherNames.join(', '),
    });
  }

  rows.push({ label: t('labels.comment'), value: comment?.trim() ?? '' });

  return rows.filter((row) => row.value.length > 0);
}

/** "csütörtök, 2. óra, 201" / "Thursday, Period 2, 201", omitting empty parts. */
function movedLessonLocation(
  day: string | null | undefined,
  period: number | null | undefined,
  room: string | null | undefined,
  locale: Locale
): string {
  return [
    day ? dayName(day, locale) : '',
    period == null ? '' : periodLabel(period, locale),
    room ?? '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** The hero chips of a moved lesson: the new day, period and room. */
function movedLessonTargetHighlights(
  target: MovedLessonDetailsPayload['target'],
  locale: Locale
): string[] {
  return [
    target.day ? dayName(target.day, locale) : '',
    target.period == null ? '' : periodLabel(target.period, locale),
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
  const resolved = normalizeLocale(locale);
  const t = createTranslator(resolved);
  const { target } = payload;

  return {
    content: buildMovedLessonContent(payload, locale),
    details: movedLessonDetails(payload, resolved, true),
    highlights: movedLessonTargetHighlights(target, resolved),
    title: t('movedLesson.title'),
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
  locale: Locale
): string {
  const t = createTranslator(locale);
  const className = payload.cohortNames.join(', ');
  const subject = payload.subjectNames.join(', ');
  const { target } = payload;
  const hasTarget =
    target.day != null || target.period != null || target.room != null;
  const location = movedLessonProseLocation(target, locale);
  const suffix = payload.original.hasMultipleSlots
    ? ` ${t('movedLesson.multipleSuffix')}`
    : '';

  let who = subject;
  if (className) {
    who = subject
      ? t('movedLesson.teacherWhoClassSubject', { className, subject })
      : t('movedLesson.teacherWhoClass', { className });
  }

  if (hasTarget) {
    return who
      ? `${t('movedLesson.teacherBodyNamedTo', { location, who })}${suffix}`
      : `${t('movedLesson.teacherBodyTo', { location })}${suffix}`;
  }

  return who
    ? `${t('movedLesson.teacherBodyNamed', { who })}${suffix}`
    : `${t('movedLesson.teacherBody')}${suffix}`;
}

/** The complete teacher-facing moved-lesson notification. */
export function buildMovedLessonTeacherContent(
  payload: MovedLessonDetailsPayload,
  locale: string
): NotificationContent {
  const resolved = normalizeLocale(locale);
  const t = createTranslator(resolved);
  const className = payload.cohortNames.join(', ');
  const title = t('movedLesson.teacherTitle');

  return {
    content: buildMovedLessonTeacherContentText(payload, resolved),
    details: movedLessonDetails(payload, resolved, false),
    highlights: movedLessonTargetHighlights(payload.target, resolved),
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
      const t = createTranslator(normalizeLocale(locale));
      return {
        content: t('cohortReselection.body'),
        metadata: { action: 'cohort_reselection', userId: p.userId },
        title: t('cohortReselection.title'),
      };
    },
    getAudience: (payload) => resolveAudienceForUser(payload),
    getDelay: () => 0,
    type: 'cohort_reselection_required',
  },
];
