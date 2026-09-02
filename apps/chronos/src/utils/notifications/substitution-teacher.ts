import { eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { userPreferences } from '#database/schema/notifications';
import {
  classroom,
  cohort,
  lesson,
  lessonCohortMTM,
  period,
  subject,
  teacher,
} from '#database/schema/timetable';
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
  date: Date;
  lessons: SubstitutionTeacherLesson[];
  /** The substitute teacher id. */
  substituter: string | null;
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
  date: Date;
  lessonIds: string[];
  substituter: string | null | undefined;
}): Promise<SubstitutionTeacherPayload> {
  const { date, lessonIds, substituter } = args;

  const lessons = lessonIds.length
    ? await db.select().from(lesson).where(inArray(lesson.id, lessonIds))
    : [];

  if (lessons.length === 0) {
    return { date, lessons: [], substituter: substituter ?? null };
  }

  const subjectIds = [...new Set(lessons.map((l) => l.subjectId))];
  const classroomIds = [
    ...new Set(
      lessons.flatMap((l) =>
        Array.isArray(l.classroomIds) ? l.classroomIds : []
      )
    ),
  ];
  const periodIds = [...new Set(lessons.map((l) => l.periodId))];
  const teacherIds = [
    ...new Set(
      lessons.flatMap((l) => (Array.isArray(l.teacherIds) ? l.teacherIds : []))
    ),
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
      subjectName: subjectMap.get(l.subjectId) ?? null,
      substitutedTeachers: (Array.isArray(l.teacherIds) ? l.teacherIds : [])
        .map((id) => teacherMap.get(id))
        .filter((name): name is string => !!name),
    };
  });

  return { date, lessons: lessonDetails, substituter: substituter ?? null };
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

/** Build the teacher-facing notification content for a substitution. */
export function buildSubstitutionTeacherContent(
  payload: SubstitutionTeacherPayload,
  locale: string
): NotificationContent {
  const hu = locale.toLowerCase().startsWith('hu');
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

  const lessonLines = (entry: SubstitutionTeacherLesson): string[] => {
    const result: string[] = [];
    const timeRange = entry.startTime
      ? ` (${entry.startTime} - ${entry.endTime ?? ''})`
      : '';
    const lessonLabel = [periodLabel(entry.period, hu), timeRange]
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
  const body =
    lessons.length === 1
      ? [
          dateLine,
          ...lessonLines(lessons[0] as SubstitutionTeacherLesson),
        ].join('\n')
      : [
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
    title,
  };
}
