import { getLogger } from '@logtape/logtape';
import { eq, inArray } from 'drizzle-orm';
import { db, prepareDb } from '#database/index';
import {
  classroom,
  cohort,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  movedLesson,
  movedLessonLessonMTM,
  period,
  substitution,
  substitutionLessonMTM,
  teacher,
} from '#database/schema/timetable';

const logger = getLogger(['chronos', 'drizzle']);

type BaseData = {
  cohorts: Array<{ id: string; name: string; timetableId: string }>;
  teachers: Array<{ id: string }>;
  days: Array<{ id: string }>;
  periods: Array<{ id: string }>;
  classrooms: Array<{ id: string }>;
};

type SubstitutionParams = {
  cohortId: string;
  lessonId: string;
  index: number;
  date: string;
  teachers: Array<{ id: string }>;
};

type MovedLessonParams = {
  cohortId: string;
  lessonId: string;
  index: number;
  date: string;
  days: Array<{ id: string }>;
  periods: Array<{ id: string }>;
  classrooms: Array<{ id: string }>;
};

const generateDates = (): string[] => {
  const today = new Date();
  const offsets = [1, 2, 3, 5, 7];

  return offsets.map((days) => {
    const date = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  });
};

const fetchBaseData = async (): Promise<BaseData> => {
  const cohorts = await db.select().from(cohort);
  const teachers = await db.select().from(teacher);
  const days = await db.select().from(dayDefinition);
  const periods = await db.select().from(period);
  const classrooms = await db.select().from(classroom);

  return { classrooms, cohorts, days, periods, teachers };
};

const getCohortLessons = async (cohortId: string) => {
  const cohortLessonRelations = await db
    .select()
    .from(lessonCohortMTM)
    .where(eq(lessonCohortMTM.cohortId, cohortId))
    .limit(5);

  if (cohortLessonRelations.length === 0) {
    return [];
  }

  const lessonIds = cohortLessonRelations.map((rel) => rel.lessonId);
  return db.select().from(lesson).where(inArray(lesson.id, lessonIds));
};

const createSubstitution = async (params: SubstitutionParams) => {
  const isCancelled = Math.random() > 0.7;
  const substituterId = isCancelled
    ? null
    : params.teachers[Math.floor(Math.random() * params.teachers.length)]?.id;

  const insertedSub = await db
    .insert(substitution)
    .values({
      date: params.date,
      id: `sub-${params.cohortId}-${params.lessonId}-${params.index}`,
      substituter: substituterId,
    })
    .returning();

  const sub = insertedSub[0];
  if (sub) {
    await db.insert(substitutionLessonMTM).values({
      lessonId: params.lessonId,
      substitutionId: sub.id,
    });

    return isCancelled ? 'cancelled' : 'substituted';
  }

  return null;
};

const createMovedLesson = async (params: MovedLessonParams) => {
  const targetDay =
    params.days.length > 0
      ? params.days[Math.floor(Math.random() * params.days.length)]?.id
      : null;
  const targetPeriod =
    params.periods.length > 0
      ? params.periods[Math.floor(Math.random() * params.periods.length)]?.id
      : null;
  const targetRoom =
    params.classrooms.length > 0 && Math.random() > 0.5
      ? params.classrooms[Math.floor(Math.random() * params.classrooms.length)]
          ?.id
      : null;

  const insertedMoved = await db
    .insert(movedLesson)
    .values({
      date: params.date,
      id: `moved-${params.cohortId}-${params.lessonId}-${params.index}`,
      room: targetRoom,
      startingDay: targetDay,
      startingPeriod: targetPeriod,
    })
    .returning();

  const moved = insertedMoved[0];
  if (moved) {
    await db.insert(movedLessonLessonMTM).values({
      lessonId: params.lessonId,
      movedLessonId: moved.id,
    });

    return true;
  }

  return false;
};

const processCohortLessons = async (
  currentCohort: { id: string; name: string },
  dates: string[],
  baseData: BaseData
) => {
  const cohortLessons = await getCohortLessons(currentCohort.id);

  for (let i = 0; i < Math.min(3, cohortLessons.length); i++) {
    const selectedLesson = cohortLessons[i];
    if (!selectedLesson) {
      continue;
    }

    const date = dates[i % dates.length];
    if (!date) {
      continue;
    }

    const isSubstitution = Math.random() > 0.5;

    if (isSubstitution) {
      const result = await createSubstitution({
        cohortId: currentCohort.id,
        date,
        index: i,
        lessonId: selectedLesson.id,
        teachers: baseData.teachers,
      });

      if (result) {
        logger.info(
          `Created ${result} lesson for cohort ${currentCohort.name}`
        );
      }
    } else {
      const created = await createMovedLesson({
        classrooms: baseData.classrooms,
        cohortId: currentCohort.id,
        date,
        days: baseData.days,
        index: i,
        lessonId: selectedLesson.id,
        periods: baseData.periods,
      });

      if (created) {
        logger.info(`Created moved lesson for cohort ${currentCohort.name}`);
      }
    }
  }
};

const seed = async () => {
  await prepareDb();

  logger.info('Seeding database...');

  const baseData = await fetchBaseData();

  if (baseData.cohorts.length === 0 || baseData.teachers.length === 0) {
    logger.error('No cohorts or teachers found. Please seed base data first.');
    return;
  }

  const dates = generateDates();

  for (const currentCohort of baseData.cohorts) {
    await processCohortLessons(currentCohort, dates, baseData);
  }

  logger.info('Database seeding completed!');
};

seed();
