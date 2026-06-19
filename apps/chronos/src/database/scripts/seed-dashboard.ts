import { getLogger } from '@logtape/logtape';
import dayjs from 'dayjs';
import { db, prepareDb } from '#database/index';
import {
  lesson,
  movedLesson,
  movedLessonLessonMTM,
  substitution,
  substitutionLessonMTM,
  teacher,
} from '#database/schema/timetable';
import { configureLogger } from '#utils/logger';

await configureLogger('chronos');
const logger = getLogger(['chronos', 'seed']);

await prepareDb();

// Get existing teachers and lessons
const teachers = await db.select({ id: teacher.id }).from(teacher);
const lessons = await db.select({ id: lesson.id }).from(lesson).limit(50);

if (lessons.length === 0) {
  logger.error('No lessons found — import a timetable first.');
  process.exit(1);
}

const today = dayjs().startOf('day');
let subIndex = 0;
let movedIndex = 0;

// Create substitutions for the next 14 days
for (let day = 0; day < 14; day++) {
  const date = today.add(day, 'day').toDate();

  // 1-3 substitutions per day
  const subCount = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < subCount; i++) {
    const picked = lessons[Math.floor(Math.random() * lessons.length)];
    if (!picked) {
      continue;
    }
    const lessonId = picked.id;
    const isCancelled = Math.random() < 0.3;
    const subId = `seed-sub-${dayjs(date).format('YYYY-MM-DD')}-${subIndex++}`;

    try {
      await db.insert(substitution).values({
        date,
        id: subId,
        substituter: isCancelled
          ? null
          : (teachers[Math.floor(Math.random() * teachers.length)]?.id ?? null),
      });
      await db.insert(substitutionLessonMTM).values({
        lessonId,
        substitutionId: subId,
      });
    } catch {
      // Skip duplicates
    }
  }
}
logger.info('Created substitutions');

// Create moved lessons for the next 14 days
for (let day = 0; day < 14; day++) {
  const date = today.add(day, 'day').toDate();

  if (Math.random() < 0.4) {
    continue; // Not every day has moved lessons
  }

  const picked = lessons[Math.floor(Math.random() * lessons.length)];
  if (!picked) {
    continue;
  }
  const lessonId = picked.id;
  const movedId = `seed-moved-${dayjs(date).format('YYYY-MM-DD')}-${movedIndex++}`;

  try {
    await db.insert(movedLesson).values({
      date,
      id: movedId,
    });
    await db.insert(movedLessonLessonMTM).values({
      lessonId,
      movedLessonId: movedId,
    });
  } catch {
    // Skip duplicates
  }
}
logger.info('Created moved lessons');
logger.info('Seed complete!');
process.exit(0);
