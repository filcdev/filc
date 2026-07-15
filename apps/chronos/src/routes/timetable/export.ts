import { and, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';
import { describeRoute } from 'hono-openapi';
import z from 'zod';
import { db } from '#database';
import {
  classroom,
  cohort,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  movedLesson,
  movedLessonLessonMTM,
  period,
  subject,
  substitution,
  substitutionLessonMTM,
  teacher,
} from '#database/schema/timetable';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { filcExt } from '#utils/openapi';
import { timetableFactory } from './_factory';

const dateRangeQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

const buildDateFilters = (
  filters: SQL<unknown>[],
  query: DateRangeQuery,
  column: SQL<unknown>
) => {
  if (query.from) {
    filters.push(gte(column, new Date(query.from)));
  }
  if (query.to) {
    filters.push(lte(column, new Date(query.to)));
  }
};

const CSV_SPECIAL_CHARS = /[",\n\r]/;
const CSV_QUOTE = /"/g;

const escapeCsvField = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (CSV_SPECIAL_CHARS.test(str)) {
    return `"${str.replace(CSV_QUOTE, '""')}"`;
  }
  return str;
};

const toCsv = (header: string[], rows: Record<string, unknown>[]): string => {
  const lines = rows.map((row) =>
    header.map((col) => escapeCsvField(row[col])).join(',')
  );
  return [header.join(','), ...lines].join('\n');
};

const buildFilename = (prefix: string): string =>
  `${prefix}-export-${new Date().toISOString().slice(0, 10)}.csv`;

export const exportSubstitutionsRoute = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Substitution', 'Export substitutions as CSV', true),
    description:
      'Export substitutions as a CSV file over an optional date range.',
    responses: {
      200: {
        content: {
          'text/csv': {
            schema: { format: 'binary', type: 'string' },
          },
        },
        description: 'CSV file with the requested substitutions',
      },
    },
    tags: ['Substitution'],
  }),
  requireAuthentication,
  requireAuthorization('substitution:create'),
  async (c) => {
    const url = new URL(c.req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const query = dateRangeQuerySchema.parse(queryParams);

    const filters: SQL<unknown>[] = [];
    buildDateFilters(
      filters,
      query,
      substitution.date as unknown as SQL<unknown>
    );

    let combined: SQL<unknown> | undefined;
    for (const clause of filters) {
      combined = combined ? and(combined, clause) : clause;
    }

    const substitutions = await db
      .select({
        comment: substitution.comment,
        date: substitution.date,
        id: substitution.id,
        substituter: substitution.substituter,
        teacherFirstName: teacher.firstName,
        teacherLastName: teacher.lastName,
        teacherShort: teacher.short,
      })
      .from(substitution)
      .leftJoin(teacher, eq(substitution.substituter, teacher.id))
      .where(combined)
      .orderBy(desc(substitution.date));

    const substitutionIds = substitutions.map((s) => s.id);

    const lessonLinks = substitutionIds.length
      ? await db
          .select({
            lessonId: substitutionLessonMTM.lessonId,
            substitutionId: substitutionLessonMTM.substitutionId,
          })
          .from(substitutionLessonMTM)
          .where(inArray(substitutionLessonMTM.substitutionId, substitutionIds))
      : [];

    const lessonIds = Array.from(new Set(lessonLinks.map((l) => l.lessonId)));

    const lessonInfo = lessonIds.length
      ? await db
          .select({
            cohortName: cohort.name,
            id: lesson.id,
            subjectName: subject.name,
            subjectShort: subject.short,
          })
          .from(lesson)
          .leftJoin(subject, eq(lesson.subjectId, subject.id))
          .leftJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
          .leftJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
          .where(inArray(lesson.id, lessonIds))
      : [];

    const lessonMap = new Map<string, { cohorts: string[]; subject: string }>();
    for (const li of lessonInfo) {
      const entry = lessonMap.get(li.id) ?? { cohorts: [], subject: '' };
      if (li.subjectShort || li.subjectName) {
        entry.subject = li.subjectShort || li.subjectName || '';
      }
      if (li.cohortName) {
        entry.cohorts.push(li.cohortName);
      }
      lessonMap.set(li.id, entry);
    }

    const lessonsBySubstitution = new Map<string, string[]>();
    for (const link of lessonLinks) {
      const list = lessonsBySubstitution.get(link.substitutionId) ?? [];
      list.push(link.lessonId);
      lessonsBySubstitution.set(link.substitutionId, list);
    }

    const header = ['date', 'teacher', 'subjects', 'cohorts', 'comment'];

    const rows = substitutions.map((s) => {
      const linkedLessonIds = lessonsBySubstitution.get(s.id) ?? [];
      const subjects = Array.from(
        new Set(
          linkedLessonIds
            .map((id) => lessonMap.get(id)?.subject)
            .filter((v): v is string => Boolean(v))
        )
      );
      const cohorts = Array.from(
        new Set(
          linkedLessonIds.flatMap((id) => lessonMap.get(id)?.cohorts ?? [])
        )
      );
      const teacherName = s.substituter
        ? `${s.teacherFirstName ?? ''} ${s.teacherLastName ?? ''}`.trim()
        : 'Cancelled';

      return {
        cohorts: cohorts.join('; '),
        comment: s.comment ?? '',
        date: s.date.toISOString().slice(0, 10),
        subjects: subjects.join('; '),
        teacher: teacherName,
      };
    });

    const csv = toCsv(header, rows);
    const filename = buildFilename('substitutions');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    return c.body(csv);
  }
);

export const exportMovedLessonsRoute = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('MovedLesson', 'Export moved lessons as CSV', true),
    description:
      'Export moved lessons as a CSV file over an optional date range.',
    responses: {
      200: {
        content: {
          'text/csv': {
            schema: { format: 'binary', type: 'string' },
          },
        },
        description: 'CSV file with the requested moved lessons',
      },
    },
    tags: ['Moved Lesson'],
  }),
  requireAuthentication,
  requireAuthorization('movedLesson:create'),
  async (c) => {
    const url = new URL(c.req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const query = dateRangeQuerySchema.parse(queryParams);

    const filters: SQL<unknown>[] = [];
    buildDateFilters(
      filters,
      query,
      movedLesson.date as unknown as SQL<unknown>
    );

    let combined: SQL<unknown> | undefined;
    for (const clause of filters) {
      combined = combined ? and(combined, clause) : clause;
    }

    const movedLessons = await db
      .select({
        classroomName: classroom.name,
        date: movedLesson.date,
        dayName: dayDefinition.name,
        dayShort: dayDefinition.short,
        id: movedLesson.id,
        periodEnd: period.endTime,
        periodNumber: period.period,
        periodStart: period.startTime,
      })
      .from(movedLesson)
      .leftJoin(classroom, eq(movedLesson.room, classroom.id))
      .leftJoin(dayDefinition, eq(movedLesson.startingDay, dayDefinition.id))
      .leftJoin(period, eq(movedLesson.startingPeriod, period.id))
      .where(combined)
      .orderBy(desc(movedLesson.date));

    const movedLessonIds = movedLessons.map((m) => m.id);

    const lessonLinks = movedLessonIds.length
      ? await db
          .select({
            lessonId: movedLessonLessonMTM.lessonId,
            movedLessonId: movedLessonLessonMTM.movedLessonId,
          })
          .from(movedLessonLessonMTM)
          .where(inArray(movedLessonLessonMTM.movedLessonId, movedLessonIds))
      : [];

    const lessonIds = Array.from(new Set(lessonLinks.map((l) => l.lessonId)));

    const lessonInfo = lessonIds.length
      ? await db
          .select({
            id: lesson.id,
            subjectName: subject.name,
            subjectShort: subject.short,
          })
          .from(lesson)
          .leftJoin(subject, eq(lesson.subjectId, subject.id))
          .where(inArray(lesson.id, lessonIds))
      : [];

    const lessonSubjectMap = new Map<string, string>();
    for (const li of lessonInfo) {
      lessonSubjectMap.set(li.id, li.subjectShort || li.subjectName || '');
    }

    const lessonsByMovedLesson = new Map<string, string[]>();
    for (const link of lessonLinks) {
      const list = lessonsByMovedLesson.get(link.movedLessonId) ?? [];
      list.push(link.lessonId);
      lessonsByMovedLesson.set(link.movedLessonId, list);
    }

    const header = [
      'date',
      'target_day',
      'target_period',
      'target_room',
      'lessons',
      'lesson_count',
    ];

    const rows = movedLessons.map((m) => {
      const linkedLessonIds = lessonsByMovedLesson.get(m.id) ?? [];
      const subjects = Array.from(
        new Set(
          linkedLessonIds
            .map((id) => lessonSubjectMap.get(id))
            .filter((v): v is string => Boolean(v))
        )
      );
      const targetDay = m.dayName
        ? `${m.dayName}${m.dayShort ? ` (${m.dayShort})` : ''}`
        : '';
      const targetPeriod = m.periodNumber
        ? `P${m.periodNumber}${
            m.periodStart && m.periodEnd
              ? ` (${String(m.periodStart).slice(0, 5)}\u2013${String(m.periodEnd).slice(0, 5)})`
              : ''
          }`
        : '';

      return {
        date: m.date.toISOString().slice(0, 10),
        lesson_count: linkedLessonIds.length,
        lessons: subjects.join('; '),
        target_day: targetDay,
        target_period: targetPeriod,
        target_room: m.classroomName ?? '',
      };
    });

    const csv = toCsv(header, rows);
    const filename = buildFilename('moved-lessons');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    return c.body(csv);
  }
);
