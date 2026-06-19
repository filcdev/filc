import { getLogger } from '@logtape/logtape';
import { like } from 'drizzle-orm';
import { db, prepareDb } from '#database/index';
import {
  movedLesson,
  movedLessonLessonMTM,
  substitution,
  substitutionLessonMTM,
} from '#database/schema/timetable';
import { configureLogger } from '#utils/logger';

await configureLogger('chronos');
const logger = getLogger(['chronos', 'cleanup']);

await prepareDb();

// Delete seed substitutions and their MTM links
await db
  .delete(substitutionLessonMTM)
  .where(like(substitutionLessonMTM.substitutionId, 'seed-sub-%'));
await db.delete(substitution).where(like(substitution.id, 'seed-sub-%'));
logger.info('Removed seed substitutions');

// Delete seed moved lessons and their MTM links
await db
  .delete(movedLessonLessonMTM)
  .where(like(movedLessonLessonMTM.movedLessonId, 'seed-moved-%'));
await db.delete(movedLesson).where(like(movedLesson.id, 'seed-moved-%'));
logger.info('Removed seed moved lessons');

logger.info('Cleanup complete!');
process.exit(0);
