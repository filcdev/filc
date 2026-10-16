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
  lesson,
  lessonCohortMTM,
  subject,
  substitutionLessonMTM,
  teacher,
} from '#modules/timetable/schema';
import {
  getActiveTimetableId,
  getTimetableIdForDate,
} from '#modules/timetable/utils/active';
import { enrichLessons } from '#modules/timetable/utils/enrich-lessons';
import {
  getWeekdayInBudapest,
  isMatchingWeekday,
} from '#modules/timetable/utils/weekday';
import { base } from '#orpc';
import { notFound } from '#utils/http';

const logger = getLogger(['chronos', 'lesson']);

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
      return { items: [], total: 0 };
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
      return { items: [], total: 0 };
    }

    const enriched = await enrichLessons(lessons);

    return { items: enriched, total: enriched.length };
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
      return { items: [], total: 0 };
    }

    const whereClause = and(
      arrayContains(lesson.teacherIds, [teacherId]),
      eq(lesson.timetableId, effectiveTimetableId)
    );

    const lessons = await db.select().from(lesson).where(whereClause);

    if (lessons.length === 0) {
      return { items: [], total: 0 };
    }

    const enriched = await enrichLessons(lessons);

    return { items: enriched, total: enriched.length };
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
      return { items: [], total: 0 };
    }

    const timetableId = await getActiveTimetableId();

    // No active timetable: yield no lessons rather than every timetable.
    if (!timetableId) {
      return { items: [], total: 0 };
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

    return { items: data, total: data.length };
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
      return { items: [], total: 0 };
    }

    const whereClause = and(
      arrayContains(lesson.classroomIds, [classroomId]),
      eq(lesson.timetableId, effectiveTimetableId)
    );

    const lessons = await db.select().from(lesson).where(whereClause);

    if (lessons.length === 0) {
      return { items: [], total: 0 };
    }

    const enriched = await enrichLessons(lessons);

    return { items: enriched, total: enriched.length };
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
    return { items: subjects, total: subjects.length };
  } catch (error) {
    logger.error('Error while fetching subjects', { error });
    throw new ORPCError('INTERNAL', { message: 'Failed to fetch subjects' });
  }
});
