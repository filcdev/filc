import { getLogger } from '@logtape/logtape';
import { ORPCError } from '@orpc/server';
import {
  and,
  arrayContains,
  arrayOverlaps,
  eq,
  inArray,
  or,
} from 'drizzle-orm';
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
  substitutionLessonMTM,
  teacher,
  weekDefinition,
} from '#modules/timetable/schema';
import {
  getActiveTimetableId,
  getTimetableIdForDate,
} from '#modules/timetable/utils/active';
import {
  getWeekdayInBudapest,
  isMatchingWeekday,
} from '#modules/timetable/utils/weekday';
import { base } from '#orpc';
import { notFound } from '#utils/http';

const logger = getLogger(['chronos', 'lesson']);

async function enrichLessons(lessons: (typeof lesson.$inferSelect)[]) {
  if (lessons.length === 0) {
    return [];
  }

  const subjectIds = Array.from(
    new Set(lessons.map((l) => l.subjectId))
  ).filter((id): id is string => id != null);
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
  const groupIds = Array.from(
    new Set(
      lessons.flatMap((l) => (Array.isArray(l.groupsIds) ? l.groupsIds : []))
    )
  );

  const weekDefinitionIds = Array.from(
    new Set(lessons.map((l) => l.weeksDefinitionId))
  );

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

export const getLessonsForCohort = base.timetable.lessons.getForCohort.handler(
  async ({ input }) => {
    const { cohortId, timetableId } = input;

    const [existingCohort] = await db
      .select()
      .from(cohort)
      .where(eq(cohort.id, cohortId))
      .limit(1);

    if (!existingCohort) {
      throw notFound('Cohort not found');
    }

    const effectiveTimetableId = timetableId ?? (await getActiveTimetableId());

    // No active timetable: yield no lessons rather than every timetable.
    if (!effectiveTimetableId) {
      return [];
    }

    const whereClause = and(
      eq(lessonCohortMTM.cohortId, cohortId),
      eq(lesson.timetableId, effectiveTimetableId)
    );

    const lessonRows = await db
      .select({ lesson })
      .from(lesson)
      .innerJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
      .where(whereClause);

    const lessons = lessonRows.map((r) => r.lesson);

    if (lessons.length === 0) {
      return [];
    }

    const enriched = await enrichLessons(lessons);

    return enriched;
  }
);

export const getLessonsForTeacher =
  base.timetable.lessons.getForTeacher.handler(async ({ input }) => {
    const { teacherId, timetableId } = input;

    const [existingTeacher] = await db
      .select()
      .from(teacher)
      .where(eq(teacher.id, teacherId))
      .limit(1);

    if (!existingTeacher) {
      throw notFound('Teacher not found');
    }

    const effectiveTimetableId = timetableId ?? (await getActiveTimetableId());

    // No active timetable: yield no lessons rather than every timetable.
    if (!effectiveTimetableId) {
      return [];
    }

    const whereClause = and(
      arrayContains(lesson.teacherIds, [teacherId]),
      eq(lesson.timetableId, effectiveTimetableId)
    );

    const lessons = await db.select().from(lesson).where(whereClause);

    if (lessons.length === 0) {
      return [];
    }

    const enriched = await enrichLessons(lessons);

    return enriched;
  });

type CandidateLessonEntry = {
  period: number;
  subjectShort: string | null;
};

// The aSc timetable export encodes substitution ("Helyettesítés") lessons as a
// single subject with short "H"; older exports used "H1"/"H2".
const SUBSTITUTION_SUBJECT_SHORTS = new Set(['H', 'H1', 'H2']);

function computeCandidateFlags(
  teacherLessons: CandidateLessonEntry[],
  selectedPeriods: number[]
): { hasConflict: boolean; hasH1: boolean; hasH2: boolean } {
  let hasH1 = false;
  let hasH2 = false;

  for (const selectedPeriod of selectedPeriods) {
    const lessonsAtPeriod = teacherLessons.filter(
      (l) => l.period === selectedPeriod
    );

    if (lessonsAtPeriod.length === 0) {
      continue;
    }

    const hasH1AtPeriod = lessonsAtPeriod.some(
      (l) => l.subjectShort === 'H' || l.subjectShort === 'H1'
    );
    const hasH2AtPeriod = lessonsAtPeriod.some((l) => l.subjectShort === 'H2');

    if (hasH1AtPeriod) {
      hasH1 = true;
    }
    if (hasH2AtPeriod) {
      hasH2 = true;
    }

    const hasConflictLesson = lessonsAtPeriod.some(
      (l) =>
        l.subjectShort === null ||
        !SUBSTITUTION_SUBJECT_SHORTS.has(l.subjectShort)
    );
    if (hasConflictLesson) {
      return { hasConflict: true, hasH1, hasH2 };
    }
  }

  return { hasConflict: false, hasH1, hasH2 };
}

type SubstitutionCandidate = {
  hasH1: boolean;
  hasH2: boolean;
  teacher: { firstName: string; id: string; lastName: string; short: string };
};

function compareSubstituteCandidates(
  a: SubstitutionCandidate,
  b: SubstitutionCandidate
): number {
  if (a.hasH1 && !b.hasH1) {
    return -1;
  }
  if (!a.hasH1 && b.hasH1) {
    return 1;
  }
  if (a.hasH2 && !b.hasH2) {
    return -1;
  }
  if (!a.hasH2 && b.hasH2) {
    return 1;
  }
  const aName = `${a.teacher.lastName} ${a.teacher.firstName}`;
  const bName = `${b.teacher.lastName} ${b.teacher.firstName}`;
  return aName.localeCompare(bName);
}

async function buildCandidateLessonsMap(
  candidateTeacherIds: string[],
  weekday: number,
  timetableId: string
): Promise<Map<string, CandidateLessonEntry[]>> {
  const candidateLessons = await db
    .select()
    .from(lesson)
    .where(
      and(
        arrayOverlaps(lesson.teacherIds, candidateTeacherIds),
        eq(lesson.timetableId, timetableId)
      )
    );

  const enrichedCandidateLessons = await enrichLessons(candidateLessons);
  const map = new Map<string, CandidateLessonEntry[]>();
  const candidateTeacherIdSet = new Set(candidateTeacherIds);

  for (const candidateLesson of enrichedCandidateLessons) {
    if (
      !(
        candidateLesson.day &&
        isMatchingWeekday(
          weekday,
          candidateLesson.day.name,
          candidateLesson.day.short
        )
      )
    ) {
      continue;
    }

    const currentPeriod = candidateLesson.period?.period;
    if (typeof currentPeriod !== 'number') {
      continue;
    }

    const subjectShort = candidateLesson.subject?.short ?? null;

    for (const lessonTeacher of candidateLesson.teachers) {
      if (!candidateTeacherIdSet.has(lessonTeacher.id)) {
        continue;
      }

      const lessons = map.get(lessonTeacher.id) ?? [];
      lessons.push({ period: currentPeriod, subjectShort });
      map.set(lessonTeacher.id, lessons);
    }
  }

  return map;
}

async function getParallelLessons(
  selectedLessons: Awaited<ReturnType<typeof enrichLessons>>,
  missingTeacherId: string,
  timetableId: string
): Promise<Awaited<ReturnType<typeof enrichLessons>>> {
  const periodIds = [
    ...new Set(
      selectedLessons
        .map((l) => l.period?.id)
        .filter((id): id is string => !!id)
    ),
  ];
  const dayIds = [
    ...new Set(
      selectedLessons.map((l) => l.day?.id).filter((id): id is string => !!id)
    ),
  ];

  if (periodIds.length === 0 || dayIds.length === 0) {
    return [];
  }

  const selectedLessonIds = selectedLessons.map((l) => l.id);

  const cohortRows = await db
    .select({ cohortId: lessonCohortMTM.cohortId })
    .from(lessonCohortMTM)
    .where(inArray(lessonCohortMTM.lessonId, selectedLessonIds));

  const cohortIds = [...new Set(cohortRows.map((r) => r.cohortId))];
  if (cohortIds.length === 0) {
    return [];
  }

  const parallelLinkRows = await db
    .select({ lessonId: lessonCohortMTM.lessonId })
    .from(lessonCohortMTM)
    .where(inArray(lessonCohortMTM.cohortId, cohortIds));

  const parallelLessonIds = [
    ...new Set(
      parallelLinkRows
        .map((r) => r.lessonId)
        .filter((id) => !selectedLessonIds.includes(id))
    ),
  ];
  if (parallelLessonIds.length === 0) {
    return [];
  }

  const rows = await db
    .select()
    .from(lesson)
    .where(
      and(
        inArray(lesson.id, parallelLessonIds),
        inArray(lesson.periodId, periodIds),
        inArray(lesson.dayDefinitionId, dayIds),
        eq(lesson.timetableId, timetableId)
      )
    );

  const enriched = await enrichLessons(rows);
  return enriched.filter(
    (l) =>
      l.teachers.length > 0 &&
      !l.teachers.some((t) => t.id === missingTeacherId)
  );
}

export const getLessonsForTeachers =
  base.timetable.lessons.getForTeachers.handler(async ({ input }) => {
    const { teacherIds } = input;
    const normalizedTeacherIds = Array.from(new Set(teacherIds));

    const existingTeachers = await db
      .select({ id: teacher.id })
      .from(teacher)
      .where(inArray(teacher.id, normalizedTeacherIds));

    const existingTeacherIds = existingTeachers.map((t) => t.id);

    if (existingTeacherIds.length === 0) {
      return [];
    }

    const timetableId = await getActiveTimetableId();

    // No active timetable: yield no lessons rather than every timetable.
    if (!timetableId) {
      return [];
    }

    const lessons = await db
      .select()
      .from(lesson)
      .where(
        and(
          eq(lesson.timetableId, timetableId),
          or(
            ...existingTeacherIds.map((id) =>
              arrayContains(lesson.teacherIds, [id])
            )
          )
        )
      );

    const enrichedLessons = await enrichLessons(lessons);
    const lessonsByTeacherId = new Map<
      string,
      (typeof enrichedLessons)[number][]
    >(existingTeacherIds.map((id) => [id, []]));

    for (const enrichedLesson of enrichedLessons) {
      for (const lessonTeacher of enrichedLesson.teachers) {
        if (!lessonsByTeacherId.has(lessonTeacher.id)) {
          continue;
        }

        lessonsByTeacherId.get(lessonTeacher.id)?.push(enrichedLesson);
      }
    }

    const data = existingTeacherIds.map((teacherId) => ({
      lessons: lessonsByTeacherId.get(teacherId) ?? [],
      teacherId,
    }));

    return data;
  });

export const getSubstitutionCandidates =
  base.timetable.lessons.getSubstitutionCandidates.handler(
    async ({ input }) => {
      const { date, missingTeacherId, selectedLessonIds, teacherIds } = input;
      const normalizedTeacherIds = Array.from(new Set(teacherIds));

      const [missingTeacher] = await db
        .select({ id: teacher.id })
        .from(teacher)
        .where(eq(teacher.id, missingTeacherId))
        .limit(1);

      if (!missingTeacher) {
        throw notFound('Teacher not found');
      }

      const weekday = getWeekdayInBudapest(date);
      const timetableId = await getTimetableIdForDate(date);

      if (!timetableId) {
        return {
          availableLessons: [],
          parallelLessons: [],
          substituteCandidates: [],
        };
      }

      const missingTeacherLessons = await db
        .select()
        .from(lesson)
        .where(
          and(
            arrayContains(lesson.teacherIds, [missingTeacherId]),
            eq(lesson.timetableId, timetableId)
          )
        );

      const enrichedMissingTeacherLessons = await enrichLessons(
        missingTeacherLessons
      );

      const availableLessons = enrichedMissingTeacherLessons.filter(
        (currentLesson) =>
          currentLesson.day
            ? isMatchingWeekday(
                weekday,
                currentLesson.day.name,
                currentLesson.day.short
              )
            : false
      );

      const selectedLessonIdsSet = new Set(selectedLessonIds);
      const selectedLessons = availableLessons.filter((currentLesson) =>
        selectedLessonIdsSet.has(currentLesson.id)
      );

      const selectedPeriods = selectedLessons
        .map((currentLesson) => currentLesson.period?.period)
        .filter(
          (currentPeriod): currentPeriod is number =>
            typeof currentPeriod === 'number'
        );

      if (selectedPeriods.length === 0) {
        return {
          availableLessons,
          parallelLessons: [],
          substituteCandidates: [],
        };
      }

      const parallelLessons = await getParallelLessons(
        selectedLessons,
        missingTeacherId,
        timetableId
      );

      const candidateTeacherIds = normalizedTeacherIds.filter(
        (teacherId) => teacherId !== missingTeacherId
      );

      if (candidateTeacherIds.length === 0) {
        return {
          availableLessons,
          parallelLessons,
          substituteCandidates: [],
        };
      }

      const candidateTeachers = await db
        .select({
          firstName: teacher.firstName,
          id: teacher.id,
          lastName: teacher.lastName,
          short: teacher.short,
        })
        .from(teacher)
        .where(inArray(teacher.id, candidateTeacherIds));

      const candidateLessonsByTeacherId = await buildCandidateLessonsMap(
        candidateTeacherIds,
        weekday,
        timetableId
      );

      const substituteCandidates = candidateTeachers
        .map((currentTeacher) => {
          const teacherLessons =
            candidateLessonsByTeacherId.get(currentTeacher.id) ?? [];
          const flags = computeCandidateFlags(teacherLessons, selectedPeriods);
          if (flags.hasConflict) {
            return null;
          }
          return {
            hasH1: flags.hasH1,
            hasH2: flags.hasH2,
            teacher: currentTeacher,
          };
        })
        .filter(
          (candidate): candidate is NonNullable<typeof candidate> =>
            candidate !== null
        )
        .sort(compareSubstituteCandidates);

      return {
        availableLessons,
        parallelLessons,
        substituteCandidates,
      };
    }
  );

export const getLessonsForRoom = base.timetable.lessons.getForRoom.handler(
  async ({ input }) => {
    const { classroomId, timetableId } = input;

    const [existingClassroom] = await db
      .select()
      .from(classroom)
      .where(eq(classroom.id, classroomId))
      .limit(1);

    if (!existingClassroom) {
      throw notFound('Classroom not found');
    }

    const effectiveTimetableId = timetableId ?? (await getActiveTimetableId());

    // No active timetable: yield no lessons rather than every timetable.
    if (!effectiveTimetableId) {
      return [];
    }

    const whereClause = and(
      arrayContains(lesson.classroomIds, [classroomId]),
      eq(lesson.timetableId, effectiveTimetableId)
    );

    const lessons = await db.select().from(lesson).where(whereClause);

    if (lessons.length === 0) {
      return [];
    }

    const enriched = await enrichLessons(lessons);

    return enriched;
  }
);

export const getLessonForId = base.timetable.lessons.getForId.handler(
  async ({ input }) => {
    const { lessonId } = input;

    const lessonRow = await db
      .select()
      .from(lesson)
      .where(eq(lesson.id, lessonId))
      .limit(1);

    if (!lessonRow) {
      return null;
    }

    const substitutionCohortRow = await db
      .select({ name: cohort.name })
      .from(substitutionLessonMTM)
      .innerJoin(
        lessonCohortMTM,
        eq(substitutionLessonMTM.lessonId, lessonCohortMTM.lessonId)
      )
      .innerJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
      .where(eq(substitutionLessonMTM.lessonId, lessonId))
      .limit(1);

    const [enriched] = await enrichLessons(lessonRow);

    if (!enriched) {
      return null;
    }

    return {
      ...enriched,
      substitutionCohortName:
        substitutionCohortRow.length > 0
          ? (substitutionCohortRow[0]?.name ?? null)
          : null,
    };
  }
);

export const getSubjects = base.timetable.subjects.handler(async () => {
  try {
    const subjects = await db.select().from(subject);
    return subjects;
  } catch (error) {
    logger.error('Error while fetching subjects', { error });
    throw new ORPCError('INTERNAL', { message: 'Failed to fetch subjects' });
  }
});
