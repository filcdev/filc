import type { Lesson } from '@filcdev/api/domains/timetable/lesson';
import { eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import {
  classroom,
  cohort,
  cohortGroup,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  period,
  subject,
  teacher,
  weekDefinition,
} from '#modules/timetable/schema';
import { distinctIds } from '#utils/collections';

/** Load lesson rows by id. Ids that no longer exist are simply absent. */
export function loadLessonsByIds(
  ids: string[]
): Promise<(typeof lesson.$inferSelect)[]> {
  if (ids.length === 0) {
    return Promise.resolve([]);
  }

  return db.select().from(lesson).where(inArray(lesson.id, ids));
}

// Enrich lesson rows with subject, cohorts, day, period, classrooms, teachers,
// groups and week definition. Callers load the rows first (see
// `loadLessonsByIds`) and map the results back onto their own id lists; ids
// that no longer resolve are dropped here.
export async function enrichLessons(
  lessons: (typeof lesson.$inferSelect)[]
): Promise<Lesson[]> {
  if (lessons.length === 0) {
    return [];
  }

  const subjectIds = distinctIds(lessons, (l) => l.subjectId);
  const dayIds = distinctIds(lessons, (l) => l.dayDefinitionId);
  const periodIds = distinctIds(lessons, (l) => l.periodId);
  const teacherIds = distinctIds(lessons, (l) => l.teacherIds);
  const classroomIds = distinctIds(lessons, (l) => l.classroomIds);
  const groupIds = distinctIds(lessons, (l) => l.groupsIds);
  const weekDefinitionIds = distinctIds(lessons, (l) => l.weeksDefinitionId);

  const lessonIds = lessons.map((l) => l.id);

  const [
    subjects,
    days,
    periods,
    teachers,
    classrooms,
    cohortRows,
    groupRows,
    weekDefinitions,
  ] = await Promise.all([
    subjectIds.length
      ? db.select().from(subject).where(inArray(subject.id, subjectIds))
      : Promise.resolve([] as (typeof subject.$inferSelect)[]),
    db.select().from(dayDefinition).where(inArray(dayDefinition.id, dayIds)),
    db.select().from(period).where(inArray(period.id, periodIds)),
    teacherIds.length
      ? db.select().from(teacher).where(inArray(teacher.id, teacherIds))
      : Promise.resolve([] as (typeof teacher.$inferSelect)[]),
    classroomIds.length
      ? db.select().from(classroom).where(inArray(classroom.id, classroomIds))
      : Promise.resolve([] as (typeof classroom.$inferSelect)[]),
    lessonIds.length
      ? db
          .select({
            cohortId: cohort.id,
            cohortName: cohort.name,
            cohortShort: cohort.short,
            lessonId: lessonCohortMTM.lessonId,
          })
          .from(lessonCohortMTM)
          .innerJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
          .where(inArray(lessonCohortMTM.lessonId, lessonIds))
      : Promise.resolve([] as never[]),
    groupIds.length
      ? db
          .select({
            divisionTag: cohortGroup.divisionTag,
            entireClass: cohortGroup.entireClass,
            id: cohortGroup.id,
            name: cohortGroup.name,
          })
          .from(cohortGroup)
          .where(inArray(cohortGroup.id, groupIds))
      : Promise.resolve([] as never[]),

    db
      .select()
      .from(weekDefinition)
      .where(inArray(weekDefinition.id, weekDefinitionIds)),
  ]);

  const subjMap = new Map(subjects.map((s) => [s.id, s] as const));
  const dayMap = new Map(days.map((d) => [d.id, d] as const));
  const periodMap = new Map(periods.map((p) => [p.id, p] as const));
  const teacherMap = new Map(teachers.map((t) => [t.id, t] as const));
  const classroomMap = new Map(classrooms.map((cr) => [cr.id, cr] as const));
  const groupMap = new Map(
    groupRows.map(
      (g) =>
        [
          g.id,
          {
            divisionTag: g.divisionTag,
            entireClass: g.entireClass,
            id: g.id,
            name: g.name,
          },
        ] as const
    )
  );
  const weekDefinitionMap = new Map(
    weekDefinitions.map((week) => [week.id, week] as const)
  );
  const cohortMap = new Map<
    string,
    { id: string; name: string; short: string }[]
  >(lessonIds.map((id) => [id, []]));
  for (const row of cohortRows) {
    const list = cohortMap.get(row.lessonId);
    if (list) {
      list.push({
        id: row.cohortId,
        name: row.cohortName,
        short: row.cohortShort,
      });
    }
  }

  return lessons.map((l) => {
    const tIds = (Array.isArray(l.teacherIds) ? l.teacherIds : []) as string[];
    const cIds = (
      Array.isArray(l.classroomIds) ? l.classroomIds : []
    ) as string[];

    return {
      classrooms: cIds
        .map((id) => classroomMap.get(id))
        .filter(Boolean)
        .map((cr) => ({
          id: (cr as (typeof classrooms)[number]).id,
          name: (cr as (typeof classrooms)[number]).name,
          short: (cr as (typeof classrooms)[number]).short,
        })),
      cohorts: (cohortMap.get(l.id) ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        short: c.short,
      })),
      day: (() => {
        const d = dayMap.get(l.dayDefinitionId);
        return d;
      })(),
      groups: (Array.isArray(l.groupsIds) ? l.groupsIds : [])
        .map((id) => groupMap.get(id))
        .filter(Boolean)
        .map((g) => ({
          divisionTag: (g as (typeof groupRows)[number]).divisionTag,
          entireClass: (g as (typeof groupRows)[number]).entireClass,
          id: (g as (typeof groupRows)[number]).id,
          name: (g as (typeof groupRows)[number]).name,
        })),
      groupsIds: (Array.isArray(l.groupsIds) ? l.groupsIds : []) as string[],
      id: l.id,
      period: (() => {
        const p = periodMap.get(l.periodId);
        return p
          ? {
              endTime: String(p.endTime),
              id: p.id,
              period: p.period,
              startTime: String(p.startTime),
            }
          : null;
      })(),
      periodsPerWeek: l.periodsPerWeek,
      subject: (() => {
        const s = subjMap.get(l.subjectId ?? '');
        return s ? { id: s.id, name: s.name, short: s.short } : null;
      })(),
      teachers: tIds
        .map((id) => teacherMap.get(id))
        .filter(Boolean)
        .map((t) => ({
          id: (t as (typeof teachers)[number]).id,
          name: `${(t as (typeof teachers)[number]).firstName} ${(t as (typeof teachers)[number]).lastName}`,
          short: (t as (typeof teachers)[number]).short,
        })),
      termDefinitionId: l.termDefinitionId,
      weekDefinition: (() => {
        const week = weekDefinitionMap.get(l.weeksDefinitionId);

        return week
          ? {
              id: week.id,
              name: week.name,
              short: week.short,
              weeks: Array.isArray(week.weeks) ? week.weeks : [],
            }
          : null;
      })(),
      weeksDefinitionId: l.weeksDefinitionId,
    };
  });
}
