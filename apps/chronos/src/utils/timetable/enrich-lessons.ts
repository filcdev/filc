import { and, eq, inArray } from 'drizzle-orm';
import z from 'zod';
import { db } from '#database';
import {
  classroom,
  cohort,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  period,
  subject,
  teacher,
} from '#database/schema/timetable';
import { createSelectSchema } from '#utils/zod';

// Enriched lesson shape shared by the substitution and moved-lesson endpoints.
export const enrichedLessonSchema = z.object({
  classrooms: z.array(
    z.object({ id: z.string(), name: z.string(), short: z.string() })
  ),
  cohorts: z.array(z.string()),
  day: createSelectSchema(dayDefinition).optional(),
  id: z.string(),
  period: z
    .object({
      endTime: z.string(),
      id: z.string(),
      period: z.number(),
      startTime: z.string(),
    })
    .nullable(),
  periodsPerWeek: z.number(),
  subject: z
    .object({ id: z.string(), name: z.string(), short: z.string() })
    .nullable(),
  teachers: z.array(
    z.object({ id: z.string(), name: z.string(), short: z.string() })
  ),
  termDefinitionId: z.string().nullable(),
  weeksDefinitionId: z.string(),
});

export type EnrichedLesson = z.infer<typeof enrichedLessonSchema>;

// Enrich a batch of lessons with subject, cohorts, day, period, classrooms and
// teachers. Returns only lessons that still exist; callers map the results back
// onto their own lesson-id lists.
//
// `timetableId` optionally scopes enrichment to a single timetable. When it is
// `undefined` (callers that predate timetable scoping), no timetable filter is
// applied. When it is a string or an explicit `null`, lessons are restricted to
// that timetable — a `null` id matches nothing (lesson.timetableId is NOT NULL),
// so a gap in active timetables returns no lessons rather than leaking retired
// ones.
export async function enrichLessons(
  lessonIds: string[],
  timetableId?: string | null
): Promise<EnrichedLesson[]> {
  if (lessonIds.length === 0) {
    return [];
  }

  // A null timetable id means "no active timetable": match nothing instead of
  // falling back to every (including retired) timetable.
  if (timetableId === null) {
    return [];
  }

  const lessons = await db
    .select()
    .from(lesson)
    .where(
      timetableId === undefined
        ? inArray(lesson.id, lessonIds)
        : and(
            inArray(lesson.id, lessonIds),
            eq(lesson.timetableId, timetableId)
          )
    );

  if (lessons.length === 0) {
    return [];
  }

  const subjectIds = Array.from(new Set(lessons.map((l) => l.subjectId)));
  const dayIds = Array.from(new Set(lessons.map((l) => l.dayDefinitionId)));
  const periodIds = Array.from(new Set(lessons.map((l) => l.periodId)));
  const teacherIds = Array.from(
    new Set(
      lessons.flatMap((l) => (Array.isArray(l.teacherIds) ? l.teacherIds : []))
    )
  );
  const classroomIds = Array.from(
    new Set(
      lessons.flatMap((l) =>
        Array.isArray(l.classroomIds) ? l.classroomIds : []
      )
    )
  );

  // Get lesson-cohort relationships
  const lessonCohorts = await db
    .select({
      cohortId: lessonCohortMTM.cohortId,
      cohortName: cohort.name,
      lessonId: lessonCohortMTM.lessonId,
    })
    .from(lessonCohortMTM)
    .innerJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
    .where(inArray(lessonCohortMTM.lessonId, lessonIds));

  // Create a map of lesson ID to cohort names
  const lessonCohortMap = new Map<string, string[]>();
  for (const lc of lessonCohorts) {
    if (!lessonCohortMap.has(lc.lessonId)) {
      lessonCohortMap.set(lc.lessonId, []);
    }
    lessonCohortMap.get(lc.lessonId)?.push(lc.cohortName);
  }

  const [subjects, days, periods, teachers, classrooms] = await Promise.all([
    db.select().from(subject).where(inArray(subject.id, subjectIds)),
    db.select().from(dayDefinition).where(inArray(dayDefinition.id, dayIds)),
    db.select().from(period).where(inArray(period.id, periodIds)),
    teacherIds.length
      ? db.select().from(teacher).where(inArray(teacher.id, teacherIds))
      : Promise.resolve([] as (typeof teacher.$inferSelect)[]),
    classroomIds.length
      ? db.select().from(classroom).where(inArray(classroom.id, classroomIds))
      : Promise.resolve([] as (typeof classroom.$inferSelect)[]),
  ]);

  const subjMap = new Map(subjects.map((s) => [s.id, s] as const));
  const dayMap = new Map(days.map((d) => [d.id, d] as const));
  const periodMap = new Map(periods.map((p) => [p.id, p] as const));
  const teacherMap = new Map(teachers.map((t) => [t.id, t] as const));
  const classroomMap = new Map(classrooms.map((cr) => [cr.id, cr] as const));

  return lessons.map((l) => {
    const tIds = (Array.isArray(l.teacherIds) ? l.teacherIds : []) as string[];
    const cIds = (
      Array.isArray(l.classroomIds) ? l.classroomIds : []
    ) as string[];
    const cohortNames = lessonCohortMap.get(l.id) || [];

    return {
      classrooms: cIds
        .map((id) => classroomMap.get(id))
        .filter(Boolean)
        .map((cr) => ({
          id: (cr as (typeof classrooms)[number]).id,
          name: (cr as (typeof classrooms)[number]).name,
          short: (cr as (typeof classrooms)[number]).short,
        })),
      cohorts: cohortNames,
      day: dayMap.get(l.dayDefinitionId),
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
        const s = subjMap.get(l.subjectId);
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
      weeksDefinitionId: l.weeksDefinitionId,
    };
  });
}
