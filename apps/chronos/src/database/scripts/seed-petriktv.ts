import { getLogger } from '@logtape/logtape';
import dayjs from 'dayjs';
import { asc, eq, inArray } from 'drizzle-orm';
import { db, prepareDb } from '#database';
import {
  classroom,
  lesson,
  movedLesson,
  movedLessonLessonMTM,
  period,
  substitution,
  substitutionLessonMTM,
  teacher,
} from '#database/schema/timetable';
import { env } from '#utils/environment';
import { configureLogger } from '#utils/logger';
import { getActiveTimetableId } from '#utils/timetable/active';

const ROW_COUNT = 16;
const TEST_PREFIX = 'petriktv-test';

const logger = getLogger(['chronos', 'petriktv-seed']);

type CandidateLesson = {
  dayDefinitionId: string;
  id: string;
  periodId: string;
};

const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

const seedPetrikTv = async () => {
  if (env.mode === 'production') {
    throw new Error('The PetrikTV test-data seeder cannot run in production.');
  }

  const timetableId = await getActiveTimetableId();
  if (!timetableId) {
    throw new Error('No active timetable found. Import a timetable first.');
  }

  const now = dayjs();
  const nowMinutes = now.hour() * 60 + now.minute();
  const today = new Date(`${now.format('YYYY-MM-DD')}T12:00:00.000Z`);

  const [teachers, classrooms, lessons] = await Promise.all([
    db.select({ id: teacher.id }).from(teacher),
    db.select({ id: classroom.id }).from(classroom),
    db
      .select({
        dayDefinitionId: lesson.dayDefinitionId,
        id: lesson.id,
        periodEndTime: period.endTime,
        periodId: lesson.periodId,
      })
      .from(lesson)
      .innerJoin(period, eq(lesson.periodId, period.id))
      .where(eq(lesson.timetableId, timetableId))
      .orderBy(asc(period.period), asc(lesson.id)),
  ]);

  const upcomingLessons: CandidateLesson[] = lessons
    .filter((item) => timeToMinutes(item.periodEndTime) > nowMinutes)
    .map(({ dayDefinitionId, id, periodId }) => ({
      dayDefinitionId,
      id,
      periodId,
    }));

  if (upcomingLessons.length === 0) {
    throw new Error('No upcoming lessons found for the active timetable.');
  }

  if (classrooms.length === 0) {
    throw new Error('No classrooms found. Moved lessons need target rooms.');
  }

  const selectedLessons = Array.from({ length: ROW_COUNT }, (_, index) => {
    const selectedLesson = upcomingLessons[index % upcomingLessons.length];
    if (!selectedLesson) {
      throw new Error('Failed to select an upcoming lesson.');
    }
    return selectedLesson;
  });

  const substitutionIds = Array.from(
    { length: ROW_COUNT },
    (_, index) => `${TEST_PREFIX}-sub-${String(index + 1).padStart(2, '0')}`
  );
  const movedLessonIds = Array.from(
    { length: ROW_COUNT },
    (_, index) => `${TEST_PREFIX}-moved-${String(index + 1).padStart(2, '0')}`
  );

  await db.transaction(async (tx) => {
    await tx
      .delete(substitutionLessonMTM)
      .where(inArray(substitutionLessonMTM.substitutionId, substitutionIds));
    await tx
      .delete(substitution)
      .where(inArray(substitution.id, substitutionIds));
    await tx
      .delete(movedLessonLessonMTM)
      .where(inArray(movedLessonLessonMTM.movedLessonId, movedLessonIds));
    await tx.delete(movedLesson).where(inArray(movedLesson.id, movedLessonIds));

    await tx.insert(substitution).values(
      selectedLessons.map((_, index) => ({
        comment: 'PetrikTV test data',
        date: today,
        id: substitutionIds[index] as string,
        substituter:
          index % 8 === 7
            ? null
            : (teachers[index % teachers.length]?.id ?? null),
      }))
    );

    await tx.insert(substitutionLessonMTM).values(
      selectedLessons.map((selectedLesson, index) => ({
        lessonId: selectedLesson.id,
        substitutionId: substitutionIds[index] as string,
      }))
    );

    await tx.insert(movedLesson).values(
      selectedLessons.map((selectedLesson, index) => ({
        comment: 'PetrikTV test data',
        date: today,
        id: movedLessonIds[index] as string,
        room: classrooms[index % classrooms.length]?.id ?? null,
        startingDay: selectedLesson.dayDefinitionId,
        startingPeriod: selectedLesson.periodId,
      }))
    );

    await tx.insert(movedLessonLessonMTM).values(
      selectedLessons.map((selectedLesson, index) => ({
        lessonId: selectedLesson.id,
        movedLessonId: movedLessonIds[index] as string,
      }))
    );
  });

  logger.info(
    `Created ${ROW_COUNT} substitutions and ${ROW_COUNT} moved lessons for ${now.format('YYYY-MM-DD')}.`
  );
};

await configureLogger('chronos');
await prepareDb();
await seedPetrikTv();
