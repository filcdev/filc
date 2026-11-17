import {
  createTranslator,
  formatMailDate,
  type Locale,
  normalizeLocale,
  periodLabel,
  weekdayOn,
} from '@filcdev/i18n';
import type { EmailDetail } from '@filcdev/mail';
import { eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import {
  classroom,
  cohort,
  lesson,
  lessonCohortMTM,
  period,
  subject,
  teacher,
} from '#modules/timetable/schema';
import { uniqueStrings } from './strings';
import { resolveTeacherUserAudience } from './teacher-audience';
import type { AudienceUser, NotificationContent } from './types';

/** One affected lesson, with the details a substitute teacher needs. */
export type SubstitutionTeacherLesson = {
  cohortName: string | null;
  endTime: string | null;
  /** Lesson number (e.g. 3). */
  period: number | null;
  rooms: string[];
  startTime: string | null;
  subjectName: string | null;
  /** The teacher(s) being replaced by the substitution. */
  substitutedTeachers: string[];
};

/** Payload carrying everything needed to notify the substitute teacher. */
export type SubstitutionTeacherPayload = {
  /** Optional note the substitution was created with. */
  comment?: string | null;
  date: Date;
  lessons: SubstitutionTeacherLesson[];
  /** The substitute teacher id. */
  substituter: string | null;
  /** The substitute teacher's display name, resolved by the loader. */
  substituterName: string | null;
};

/** "07:10:00" -> "07:10"; anything else -> null. */
const formatTime = (value: unknown): string | null => {
  const str = typeof value === 'string' ? value : null;
  return str ? str.slice(0, 5) : null;
};

/**
 * Load the enriched details of the affected lessons so the substitute-teacher
 * notification can include the date, lesson number/time, class, subject, room
 * and replaced teacher(s).
 */
export async function loadSubstitutionTeacherPayload(args: {
  comment?: string | null;
  date: Date;
  lessonIds: string[];
  substituter: string | null | undefined;
}): Promise<SubstitutionTeacherPayload> {
  const { comment, date, lessonIds, substituter } = args;
  const substituterId = substituter ?? null;

  const lessons = lessonIds.length
    ? await db.select().from(lesson).where(inArray(lesson.id, lessonIds))
    : [];

  const subjectIds = [...new Set(lessons.map((l) => l.subjectId))].filter(
    (id): id is string => id != null
  );
  const classroomIds = [
    ...new Set(
      lessons.flatMap((l) =>
        Array.isArray(l.classroomIds) ? l.classroomIds : []
      )
    ),
  ];
  const periodIds = [...new Set(lessons.map((l) => l.periodId))];
  const teacherIds = [
    ...new Set([
      ...lessons.flatMap((l) =>
        Array.isArray(l.teacherIds) ? l.teacherIds : []
      ),
      ...(substituterId ? [substituterId] : []),
    ]),
  ];

  const [subjects, classrooms, periods, teachers, cohortRows] =
    await Promise.all([
      subjectIds.length
        ? db.select().from(subject).where(inArray(subject.id, subjectIds))
        : Promise.resolve([]),
      classroomIds.length
        ? db.select().from(classroom).where(inArray(classroom.id, classroomIds))
        : Promise.resolve([]),
      periodIds.length
        ? db.select().from(period).where(inArray(period.id, periodIds))
        : Promise.resolve([]),
      teacherIds.length
        ? db.select().from(teacher).where(inArray(teacher.id, teacherIds))
        : Promise.resolve([]),
      lessons.length
        ? db
            .select({
              cohortName: cohort.name,
              lessonId: lessonCohortMTM.lessonId,
            })
            .from(lessonCohortMTM)
            .innerJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
            .where(inArray(lessonCohortMTM.lessonId, lessonIds))
        : Promise.resolve([]),
    ]);

  const subjectMap = new Map(subjects.map((s) => [s.id, s.name] as const));
  const classroomMap = new Map(classrooms.map((c) => [c.id, c.name] as const));
  const periodMap = new Map(periods.map((p) => [p.id, p] as const));
  const teacherMap = new Map(
    teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`.trim()] as const)
  );
  const cohortByLesson = new Map<string, string>();
  for (const row of cohortRows) {
    if (!cohortByLesson.has(row.lessonId)) {
      cohortByLesson.set(row.lessonId, row.cohortName);
    }
  }

  const lessonDetails: SubstitutionTeacherLesson[] = lessons.map((l) => {
    const periodInfo = periodMap.get(l.periodId);
    return {
      cohortName: cohortByLesson.get(l.id) ?? null,
      endTime: formatTime(periodInfo?.endTime),
      period: periodInfo?.period ?? null,
      rooms: (Array.isArray(l.classroomIds) ? l.classroomIds : [])
        .map((id) => classroomMap.get(id))
        .filter((name): name is string => !!name),
      startTime: formatTime(periodInfo?.startTime),
      subjectName: subjectMap.get(l.subjectId ?? '') ?? null,
      substitutedTeachers: (Array.isArray(l.teacherIds) ? l.teacherIds : [])
        .map((id) => teacherMap.get(id))
        .filter((name): name is string => !!name),
    };
  });

  return {
    comment: comment ?? null,
    date,
    lessons: lessonDetails,
    substituter: substituterId,
    substituterName: substituterId
      ? (teacherMap.get(substituterId) ?? null)
      : null,
  };
}

/** Resolve the linked user (and thus email) of the substitute teacher. */
export async function resolveSubstituteTeacherAudience(
  payload: SubstitutionTeacherPayload
): Promise<AudienceUser[]> {
  const { substituter } = payload;
  if (!substituter) {
    return [];
  }

  // Shared with the moved-lesson mail: a `teacher` row -> its linked user.
  return await resolveTeacherUserAudience([substituter]);
}

/** The "(07:10 - 07:55)" suffix for a lesson, or an empty string when it has no start. */
const timeRangeLabel = (entry: SubstitutionTeacherLesson): string => {
  if (!entry.startTime) {
    return '';
  }
  return entry.endTime
    ? `(${entry.startTime} - ${entry.endTime})`
    : `(${entry.startTime})`;
};

/** Hero chips for the substitute-teacher email: first lesson and first class. */
const buildSubstitutionTeacherHighlights = (
  payload: SubstitutionTeacherPayload,
  locale: Locale
): string[] => {
  const first = payload.lessons[0];
  if (!first) {
    return [];
  }
  const periodPart =
    first.period == null ? '' : periodLabel(first.period, locale);
  return [
    `${periodPart} ${timeRangeLabel(first)}`.trim(),
    first.cohortName ?? '',
  ]
    .filter(Boolean)
    .slice(0, 4);
};

/**
 * The single-lesson details card, using the same labels as the student-facing
 * `buildSubstitutionDetails` so the two substitution emails match.
 */
const buildSubstitutionTeacherDetails = (
  payload: SubstitutionTeacherPayload,
  locale: Locale
): EmailDetail[] => {
  const t = createTranslator(locale);
  const [first] = payload.lessons;
  if (!first) {
    return [];
  }

  const rows: EmailDetail[] = [
    { label: t('labels.date'), value: formatMailDate(payload.date, locale) },
    { label: t('labels.class'), value: first.cohortName ?? '' },
    { label: t('labels.subject'), value: first.subjectName ?? '' },
    {
      label: t('labels.lesson'),
      value: [
        first.period == null ? '' : periodLabel(first.period, locale),
        timeRangeLabel(first),
      ]
        .filter(Boolean)
        .join(' '),
    },
    {
      label: t('labels.room'),
      value: uniqueStrings(first.rooms).join(', '),
    },
    {
      label: t('labels.substitutedTeacher'),
      value: uniqueStrings(first.substitutedTeachers).join(', '),
    },
    { label: t('labels.comment'), value: payload.comment?.trim() ?? '' },
  ];

  return rows.filter((row) => row.value.length > 0);
};

/**
 * The multi-lesson details card: the date, then one row per affected lesson.
 * The label carries the period and the class so the rows stay readable without
 * a header, and a duplicate label gets a numeric suffix because the mail
 * template keys its rows by label.
 */
export const buildSubstitutionMultiLessonDetails = (
  payload: SubstitutionTeacherPayload,
  locale: Locale
): EmailDetail[] => {
  const t = createTranslator(locale);
  const seen = new Map<string, number>();
  const lessonFallback = t('labels.lesson');

  const rows: EmailDetail[] = [
    { label: t('labels.date'), value: formatMailDate(payload.date, locale) },
    ...payload.lessons.map((entry) => {
      const base =
        [
          entry.period == null ? '' : periodLabel(entry.period, locale),
          entry.cohortName,
        ]
          .filter(Boolean)
          .join(' · ') || lessonFallback;
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);

      return {
        label: count > 1 ? `${base} · ${count}` : base,
        value: uniqueStrings([
          entry.subjectName,
          entry.rooms.length > 0 ? entry.rooms.join(', ') : null,
          entry.substitutedTeachers.length > 0
            ? entry.substitutedTeachers.join(', ')
            : null,
        ]).join(' · '),
      };
    }),
  ];

  const comment = payload.comment?.trim();
  if (comment) {
    rows.push({ label: t('labels.comment'), value: comment });
  }

  return rows.filter((row) => row.value.length > 0);
};

/** Build the teacher-facing notification content for a substitution. */
export function buildSubstitutionTeacherContent(
  payload: SubstitutionTeacherPayload,
  locale: string
): NotificationContent {
  const resolved = normalizeLocale(locale);
  const t = createTranslator(resolved);
  const { date, lessons } = payload;

  const first = lessons[0];
  const firstPeriod =
    first?.period == null ? '' : periodLabel(first.period, resolved);

  let title = t('substitution.teacherTitle');
  if (first?.cohortName) {
    title = `${title} – ${first.cohortName}`;
    if (firstPeriod) {
      title = `${title} – ${firstPeriod}`;
    }
  }

  if (lessons.length === 0) {
    return { content: '', title };
  }

  const highlights = buildSubstitutionTeacherHighlights(payload, resolved);

  if (lessons.length === 1) {
    return {
      content: t('substitution.teacherIntro'),
      details: buildSubstitutionTeacherDetails(payload, resolved),
      highlights,
      title,
    };
  }

  // The rows carry the per-lesson information, so the body stays one sentence:
  // the mail template renders the hero, then the detail rows below it.
  const content = t('substitution.teacherMulti', {
    count: lessons.length,
    weekday: weekdayOn(date.getDay(), resolved),
  });

  return {
    content,
    details: buildSubstitutionMultiLessonDetails(payload, resolved),
    highlights,
    title,
  };
}

/**
 * Build the structured label/value rows for the student-facing `substitution`
 * email. Every row is optional: a row whose value is empty is omitted.
 */
export function buildSubstitutionDetails(
  payload: SubstitutionTeacherPayload,
  locale: string
): EmailDetail[] {
  const resolved = normalizeLocale(locale);
  const t = createTranslator(resolved);
  const { comment, date, lessons, substituter, substituterName } = payload;

  const lessonLabels = lessons
    .map((entry) => {
      let timeRange = '';
      if (entry.startTime) {
        timeRange = entry.endTime
          ? ` (${entry.startTime} - ${entry.endTime})`
          : ` (${entry.startTime})`;
      }
      const periodPart =
        entry.period == null ? '' : periodLabel(entry.period, resolved);
      return `${periodPart}${timeRange}`.trim();
    })
    .filter((value) => value.length > 0);

  const rows: EmailDetail[] = [
    { label: t('labels.date'), value: formatMailDate(date, resolved) },
    {
      label: t('labels.class'),
      value: uniqueStrings(lessons.map((entry) => entry.cohortName)).join(', '),
    },
    {
      label: t('labels.subject'),
      value: uniqueStrings(lessons.map((entry) => entry.subjectName)).join(
        ', '
      ),
    },
    { label: t('labels.lesson'), value: lessonLabels.join(' · ') },
    {
      label: t('labels.room'),
      value: uniqueStrings(lessons.flatMap((entry) => entry.rooms)).join(', '),
    },
    {
      label: t('labels.substitutedTeacher'),
      value: uniqueStrings(
        lessons.flatMap((entry) => entry.substitutedTeachers)
      ).join(', '),
    },
    {
      label: t('labels.substitute'),
      value: substituter ? (substituterName ?? '') : t('labels.cancelled'),
    },
    { label: t('labels.comment'), value: comment?.trim() ?? '' },
  ];

  return rows.filter((row) => row.value.length > 0);
}
