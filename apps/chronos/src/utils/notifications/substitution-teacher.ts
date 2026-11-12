import type { EmailDetail } from '@filcdev/mail';
import { eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { userPreferences } from '#modules/notifications/schema';
import {
  classroom,
  cohort,
  lesson,
  lessonCohortMTM,
  period,
  subject,
  teacher,
} from '#modules/timetable/schema';
import { isHungarianLocale } from './locale';
import type { AudienceUser, NotificationContent } from './types';

const TRAILING_NEWLINES = /\n+$/;

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

const formatDate = (value: Date, hu: boolean): string => {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = value.getFullYear();
  return hu ? `${year}. ${month}. ${day}.` : `${year}-${month}-${day}`;
};

const periodLabel = (periodNo: number | null, hu: boolean): string => {
  if (periodNo == null) {
    return '';
  }
  return hu ? `${periodNo}. óra` : `Period ${periodNo}`;
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

  const [teacherRow] = await db
    .select({ userId: teacher.userId })
    .from(teacher)
    .where(eq(teacher.id, substituter))
    .limit(1);

  if (!teacherRow?.userId) {
    return [];
  }

  const [userRow] = await db
    .select({
      cohortId: userTable.cohortId,
      email: userTable.email,
      id: userTable.id,
    })
    .from(userTable)
    .where(eq(userTable.id, teacherRow.userId))
    .limit(1);

  if (!userRow) {
    return [];
  }

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userRow.id))
    .limit(1);

  return [
    {
      cohortId: userRow.cohortId,
      email: userRow.email,
      id: userRow.id,
      language: prefs?.language ?? 'hu',
    },
  ];
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
  hu: boolean
): string[] => {
  const first = payload.lessons[0];
  if (!first) {
    return [];
  }
  return [
    `${periodLabel(first.period, hu)} ${timeRangeLabel(first)}`.trim(),
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
  hu: boolean
): EmailDetail[] => {
  const [first] = payload.lessons;
  if (!first) {
    return [];
  }

  const label = {
    class: hu ? 'Osztály' : 'Class',
    comment: hu ? 'Megjegyzés' : 'Comment',
    date: hu ? 'Dátum' : 'Date',
    lesson: hu ? 'Óra' : 'Lesson',
    room: hu ? 'Terem' : 'Room',
    subject: hu ? 'Tantárgy' : 'Subject',
    substituted: hu ? 'Helyettesített tanár' : 'Substituted teacher',
  };

  const rows: EmailDetail[] = [
    { label: label.date, value: formatDate(payload.date, hu) },
    { label: label.class, value: first.cohortName ?? '' },
    { label: label.subject, value: first.subjectName ?? '' },
    {
      label: label.lesson,
      value: [periodLabel(first.period, hu), timeRangeLabel(first)]
        .filter(Boolean)
        .join(' '),
    },
    { label: label.room, value: uniqueStrings(first.rooms).join(', ') },
    {
      label: label.substituted,
      value: uniqueStrings(first.substitutedTeachers).join(', '),
    },
    { label: label.comment, value: payload.comment?.trim() ?? '' },
  ];

  return rows.filter((row) => row.value.length > 0);
};

/** Build the teacher-facing notification content for a substitution. */
export function buildSubstitutionTeacherContent(
  payload: SubstitutionTeacherPayload,
  locale: string
): NotificationContent {
  const hu = isHungarianLocale(locale);
  const { date, lessons } = payload;

  const label = {
    cohort: hu ? 'Osztály' : 'Class',
    date: hu ? 'Dátum' : 'Date',
    intro: hu
      ? 'Új helyettesítést jelöltek ki hozzád.'
      : 'You have been assigned a new substitution.',
    lessons: hu ? 'Órák' : 'Lessons',
    period: hu ? 'Óra' : 'Lesson',
    replaced: hu ? 'Helyettesített tanár' : 'Substituted teacher',
    room: hu ? 'Terem' : 'Room',
    subject: hu ? 'Tárgy' : 'Subject',
    title: hu ? 'Új helyettesítés' : 'New substitution',
  };

  const first = lessons[0];
  const firstPeriod = first ? periodLabel(first.period, hu) : '';

  let title = label.title;
  if (first?.cohortName) {
    title = `${title} – ${first.cohortName}`;
    if (firstPeriod) {
      title = `${title} – ${firstPeriod}`;
    }
  }

  if (lessons.length === 0) {
    return { content: '', title };
  }

  const highlights = buildSubstitutionTeacherHighlights(payload, hu);

  if (lessons.length === 1) {
    return {
      content: label.intro,
      details: buildSubstitutionTeacherDetails(payload, hu),
      highlights,
      title,
    };
  }

  const lessonLines = (entry: SubstitutionTeacherLesson): string[] => {
    const result: string[] = [];
    const lessonLabel = [periodLabel(entry.period, hu), timeRangeLabel(entry)]
      .filter(Boolean)
      .join(' ');
    if (lessonLabel) {
      result.push(`${label.period}: ${lessonLabel}`);
    }
    if (entry.cohortName) {
      result.push(`${label.cohort}: ${entry.cohortName}`);
    }
    if (entry.subjectName) {
      result.push(`${label.subject}: ${entry.subjectName}`);
    }
    if (entry.rooms.length > 0) {
      result.push(`${label.room}: ${entry.rooms.join(', ')}`);
    }
    if (entry.substitutedTeachers.length > 0) {
      result.push(`${label.replaced}: ${entry.substitutedTeachers.join(', ')}`);
    }
    return result;
  };

  const dateLine = `${label.date}: ${formatDate(date, hu)}`;
  const body = [
    dateLine,
    '',
    ...lessons.flatMap((entry, i) => [
      `${label.lessons} (${i + 1}):`,
      ...lessonLines(entry),
      '',
    ]),
  ]
    .join('\n')
    .replace(TRAILING_NEWLINES, '');

  return {
    content: `${label.intro}\n\n${body}`,
    highlights,
    title,
  };
}

/** Deduplicated, non-empty strings in first-seen order. Shared by the email
 * detail builders (substitution and moved lesson). */
export const uniqueStrings = (
  values: (string | null | undefined)[]
): string[] => [...new Set(values.filter((value): value is string => !!value))];

/**
 * Build the structured label/value rows for the student-facing `substitution`
 * email. Every row is optional: a row whose value is empty is omitted.
 */
export function buildSubstitutionDetails(
  payload: SubstitutionTeacherPayload,
  locale: string
): EmailDetail[] {
  const hu = isHungarianLocale(locale);
  const { comment, date, lessons, substituter, substituterName } = payload;

  const label = {
    cancelled: hu ? 'Lemarad' : 'Cancelled',
    class: hu ? 'Osztály' : 'Class',
    comment: hu ? 'Megjegyzés' : 'Comment',
    date: hu ? 'Dátum' : 'Date',
    lesson: hu ? 'Óra' : 'Lesson',
    room: hu ? 'Terem' : 'Room',
    subject: hu ? 'Tantárgy' : 'Subject',
    substitute: hu ? 'Helyettesítő' : 'Substitute',
    substituted: hu ? 'Helyettesített tanár' : 'Substituted teacher',
  };

  const lessonLabels = lessons
    .map((entry) => {
      let timeRange = '';
      if (entry.startTime) {
        timeRange = entry.endTime
          ? ` (${entry.startTime} - ${entry.endTime})`
          : ` (${entry.startTime})`;
      }
      return `${periodLabel(entry.period, hu)}${timeRange}`.trim();
    })
    .filter((value) => value.length > 0);

  const rows: EmailDetail[] = [
    { label: label.date, value: formatDate(date, hu) },
    {
      label: label.class,
      value: uniqueStrings(lessons.map((entry) => entry.cohortName)).join(', '),
    },
    {
      label: label.subject,
      value: uniqueStrings(lessons.map((entry) => entry.subjectName)).join(
        ', '
      ),
    },
    { label: label.lesson, value: lessonLabels.join(' · ') },
    {
      label: label.room,
      value: uniqueStrings(lessons.flatMap((entry) => entry.rooms)).join(', '),
    },
    {
      label: label.substituted,
      value: uniqueStrings(
        lessons.flatMap((entry) => entry.substitutedTeachers)
      ).join(', '),
    },
    {
      label: label.substitute,
      value: substituter ? (substituterName ?? '') : label.cancelled,
    },
    { label: label.comment, value: comment?.trim() ?? '' },
  ];

  return rows.filter((row) => row.value.length > 0);
}
