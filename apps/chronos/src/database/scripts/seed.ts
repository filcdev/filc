import fs from 'node:fs';
import path from 'node:path';
import { checkbox, confirm } from '@inquirer/prompts';
import { getLogger } from '@logtape/logtape';
import dayjs from 'dayjs';
import { eq, inArray } from 'drizzle-orm';
import { decode, encode } from 'iconv-lite';
import { DOMParser } from 'xmldom';
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
import { configureLogger } from '#utils/logger';
import { importTimetableXML } from '#utils/timetable/imports';

const CANCELLATION_PROBABILITY = 0.3;
const SUBSTITUTION_ROOM_PROBABILITY = 0.4;

await configureLogger('chronos');

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
  const offsets = [1, 2, 3, 5, 7];

  return offsets.map((days) => dayjs().add(days, 'day').toISOString());
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
  const isCancelled = Math.random() < CANCELLATION_PROBABILITY;
  const substituterId = isCancelled
    ? null
    : params.teachers[Math.floor(Math.random() * params.teachers.length)]?.id;

  const created = await db.transaction(async (tx) => {
    const [insertedSub] = await tx
      .insert(substitution)
      .values({
        date: params.date,
        id: `sub-${params.cohortId}-${params.lessonId}-${params.index}`,
        substituter: substituterId,
      })
      .returning();

    if (!insertedSub) {
      return null;
    }

    await tx.insert(substitutionLessonMTM).values({
      lessonId: params.lessonId,
      substitutionId: insertedSub.id,
    });

    return isCancelled ? 'cancelled' : 'substituted';
  });

  return created;
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
    params.classrooms.length > 0 &&
    Math.random() > SUBSTITUTION_ROOM_PROBABILITY
      ? params.classrooms[Math.floor(Math.random() * params.classrooms.length)]
          ?.id
      : null;

  const created = await db.transaction(async (tx) => {
    const insertedMoved = await tx
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
    if (!moved) {
      return false;
    }

    await tx.insert(movedLessonLessonMTM).values({
      lessonId: params.lessonId,
      movedLessonId: moved.id,
    });

    return true;
  });

  return created;
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

const importBaseData = async () => {
  logger.info('Importing base timetable data...');

  const baseTimetableXmlPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'public',
    'timetables',
    'dev.xml'
  );

  const xmlBuffer = fs.readFileSync(baseTimetableXmlPath);
  const decoded = decode(xmlBuffer, 'win1250');
  const utf8Text = encode(decoded, 'utf-8').toString();
  const cleaned = utf8Text.replaceAll('Period=""', '');

  const xmlData = new DOMParser().parseFromString(cleaned, 'application/xml');

  await importTimetableXML(xmlData, {
    name: 'Default Timetable',
    validFrom: dayjs().toISOString(),
  });

  logger.info('Base data imported.');
};

const seedLessons = async (baseData: BaseData) => {
  const dates = generateDates();

  for (const currentCohort of baseData.cohorts) {
    await processCohortLessons(currentCohort, dates, baseData);
  }
};

const seed = async () => {
  await prepareDb();

  logger.info('Seeding database...');

  let baseData = await fetchBaseData();

  if (baseData.cohorts.length === 0 || baseData.teachers.length === 0) {
    const proceed = await confirm({
      message:
        'No base timetable data found. Do you want to import the default timetable?',
    });

    if (!proceed) {
      logger.info(
        "Seeding aborted by user. You'll need to import a timetable first."
      );
      process.exit(1);
    }

    await importBaseData();
    baseData = await fetchBaseData();
  }

  const modules = await checkbox({
    choices: [
      { name: 'Substitutions and Moved Lessons', value: 'lessons' },
      // Future modules can be added here
    ],
    message: 'Select which modules to seed:',
  });

  const moduleMapping = {
    lessons: seedLessons,
  };

  if (modules.length === 0) {
    logger.info('No modules selected. Exiting seeding process.');
    process.exit(0);
  }

  for (const module of modules) {
    const seedFunction = moduleMapping[module as keyof typeof moduleMapping];
    if (seedFunction) {
      logger.info(`Seeding module: ${module}...`);
      try {
        await seedFunction(baseData);
      } catch (error) {
        logger.error(`Error seeding module ${module}:`, { error });
      }
    }
  }

  logger.info('Database seeding completed!');
};

await seed();
