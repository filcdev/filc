import type { DateRangeQueryInput } from '@filcdev/api/domains/timetable/export';
import { permissions } from '@filcdev/api/permissions';
import { desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';

import { db } from '#database';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
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
} from '#modules/timetable/schema';
import { base } from '#orpc';
import { andAll } from '#utils/drizzle';

const buildDateFilters = (
  filters: SQL<unknown>[],
  query: DateRangeQueryInput,
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

export const exportSubstitutionsRoute = base.timetable.substitutions.export
  .use(requireAuthentication)
  .use(requireAuthorization(permissions.substitutionCreate))
  .handler(async ({ input }) => {
    const query = input;

    const filters: SQL<unknown>[] = [];
    buildDateFilters(
      filters,
      query,
      substitution.date as unknown as SQL<unknown>
    );

    const combined = andAll(filters);

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
    return new File([csv], filename, { type: 'text/csv; charset=utf-8' });
  });

export const exportMovedLessonsRoute = base.timetable.movedLessons.export
  .use(requireAuthentication)
  .use(requireAuthorization(permissions.movedLessonCreate))
  .handler(async ({ input }) => {
    const query = input;

    const filters: SQL<unknown>[] = [];
    buildDateFilters(
      filters,
      query,
      movedLesson.date as unknown as SQL<unknown>
    );

    const combined = andAll(filters);

    const movedLessons = await db
      .select({
        classroomName: classroom.name,
        date: movedLesson.date,
        dayName: dayDefinition.name,
        dayShort: dayDefinition.short,
        id: movedLesson.id,
        manualCohortIds: movedLesson.manualCohortIds,
        manualSourceRoomId: movedLesson.manualSourceRoomId,
        manualSubjectId: movedLesson.manualSubjectId,
        manualTeacherIds: movedLesson.manualTeacherIds,
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

    const lessonSubjectMap = new Map<string, string>();
    const lessonCohortMap = new Map<string, string[]>();
    for (const li of lessonInfo) {
      if (li.subjectShort || li.subjectName) {
        lessonSubjectMap.set(li.id, li.subjectShort || li.subjectName || '');
      }
      if (li.cohortName) {
        const list = lessonCohortMap.get(li.id) ?? [];
        list.push(li.cohortName);
        lessonCohortMap.set(li.id, list);
      }
    }

    // Manual moves have no lesson links: resolve their subject, cohorts and
    // source room.
    const manualSubjectIds = Array.from(
      new Set(
        movedLessons
          .map((m) => m.manualSubjectId)
          .filter((id): id is string => id !== null)
      )
    );
    const manualCohortIds = Array.from(
      new Set(movedLessons.flatMap((m) => m.manualCohortIds))
    );
    const manualSourceRoomIds = Array.from(
      new Set(
        movedLessons
          .map((m) => m.manualSourceRoomId)
          .filter((id): id is string => id !== null)
      )
    );

    const [manualSubjects, manualCohorts, manualSourceRooms] =
      await Promise.all([
        manualSubjectIds.length
          ? db
              .select()
              .from(subject)
              .where(inArray(subject.id, manualSubjectIds))
          : Promise.resolve([] as (typeof subject.$inferSelect)[]),
        manualCohortIds.length
          ? db.select().from(cohort).where(inArray(cohort.id, manualCohortIds))
          : Promise.resolve([] as (typeof cohort.$inferSelect)[]),
        manualSourceRoomIds.length
          ? db
              .select({
                id: classroom.id,
                name: classroom.name,
                short: classroom.short,
              })
              .from(classroom)
              .where(inArray(classroom.id, manualSourceRoomIds))
          : Promise.resolve(
              [] as { id: string; name: string; short: string }[]
            ),
      ]);

    const manualSubjectMap = new Map(
      manualSubjects.map((s) => [s.id, s.short || s.name])
    );
    const manualCohortMap = new Map(manualCohorts.map((c) => [c.id, c.name]));
    const manualSourceRoomMap = new Map(
      manualSourceRooms.map((cr) => [cr.id, cr.short || cr.name])
    );

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
      'subject',
      'classes',
      'source_room',
    ];

    type MovedLessonExportRow = (typeof movedLessons)[number];

    const targetDay = (m: MovedLessonExportRow): string =>
      m.dayName ? `${m.dayName}${m.dayShort ? ` (${m.dayShort})` : ''}` : '';

    const targetPeriod = (m: MovedLessonExportRow): string =>
      m.periodNumber
        ? `P${m.periodNumber}${m.periodStart && m.periodEnd ? ` (${String(m.periodStart).slice(0, 5)}\u2013${String(m.periodEnd).slice(0, 5)})` : ''}`
        : '';

    const subjectValue = (
      m: MovedLessonExportRow,
      subjects: string[]
    ): string =>
      m.manualSubjectId
        ? (manualSubjectMap.get(m.manualSubjectId) ?? '')
        : subjects.join('; ');

    const classesValue = (
      m: MovedLessonExportRow,
      classes: string[]
    ): string =>
      m.manualCohortIds.length > 0
        ? m.manualCohortIds
            .map((id) => manualCohortMap.get(id))
            .filter((v): v is string => Boolean(v))
            .join('; ')
        : classes.join('; ');

    // The source room is a manual-only field; linked moves derive their source
    // rooms from the linked lessons, so the column stays empty for them.
    const sourceRoomValue = (m: MovedLessonExportRow): string =>
      m.manualSourceRoomId
        ? (manualSourceRoomMap.get(m.manualSourceRoomId) ?? '')
        : '';

    const rows = movedLessons.map((m) => {
      const linkedLessonIds = lessonsByMovedLesson.get(m.id) ?? [];
      const subjects = Array.from(
        new Set(
          linkedLessonIds
            .map((id) => lessonSubjectMap.get(id))
            .filter((v): v is string => Boolean(v))
        )
      );
      const classes = Array.from(
        new Set(linkedLessonIds.flatMap((id) => lessonCohortMap.get(id) ?? []))
      );

      return {
        classes: classesValue(m, classes),
        date: m.date.toISOString().slice(0, 10),
        lesson_count: linkedLessonIds.length,
        lessons: subjects.join('; '),
        source_room: sourceRoomValue(m),
        subject: subjectValue(m, subjects),
        target_day: targetDay(m),
        target_period: targetPeriod(m),
        target_room: m.classroomName ?? '',
      };
    });

    const csv = toCsv(header, rows);
    const filename = buildFilename('moved-lessons');
    return new File([csv], filename, { type: 'text/csv; charset=utf-8' });
  });
