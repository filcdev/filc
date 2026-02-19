import { timetableFactory } from '#routes/timetable/_factory';
import { getCohortsForTimetable } from '#routes/timetable/cohort';
import { importRoute } from '#routes/timetable/import';
import {
  getAllTimetables,
  getAllValidTimetables,
  getLatestValidTimetable,
} from '#routes/timetable/index';
import {
  getLessonForId,
  getLessonsForCohort,
  getLessonsForRoom,
  getLessonsForTeacher,
} from '#routes/timetable/lesson';
import {
  createMovedLesson,
  deleteMovedLesson,
  getAllMovedLessons,
  getMovedLessonsForCohort,
  getRelevantMovedLessons,
  getRelevantMovedLessonsForCohort,
  updateMovedLesson,
} from '#routes/timetable/moved-lesson';
import {
  createSubstitution,
  deleteSubstitution,
  getAllSubstitutions,
  getRelevantSubstitutions,
  getRelevantSubstitutionsForCohort,
  updateSubstitution,
} from '#routes/timetable/substitution';
import { getClassrooms } from './room';
import { getTeachers } from './teacher';

export const timetableRouter = timetableFactory
  .createApp()
  // Timetable routes
  .get('/timetables', ...getAllTimetables)
  .get('/timetables/latestValid', ...getLatestValidTimetable)
  .get('/timetables/valid', ...getAllValidTimetables)
  .post('/import', ...importRoute)
  // Substitution routes
  .get('/substitutions', ...getAllSubstitutions)
  .get('/substitutions/relevant', ...getRelevantSubstitutions)
  .get('/substitutions/cohort/:cohortId', ...getRelevantSubstitutionsForCohort)
  .post('/substitutions', ...createSubstitution)
  .put('/substitutions/:id', ...updateSubstitution)
  .delete('/substitutions/:id', ...deleteSubstitution)
  // Moved lesson routes
  .get('/movedLessons', ...getAllMovedLessons)
  .get('/movedLessons/relevant', ...getRelevantMovedLessons)
  .get('/movedLessons/cohort/:cohortId', ...getMovedLessonsForCohort)
  .get(
    '/movedLessons/cohort/:cohortId/relevant',
    ...getRelevantMovedLessonsForCohort
  )
  .post('/movedLessons', ...createMovedLesson)
  .put('/movedLessons/:id', ...updateMovedLesson)
  .delete('/movedLessons/:id', ...deleteMovedLesson)
  // Lesson routes
  .get('/lessons/getForCohort/:cohortId', ...getLessonsForCohort)
  .get('/lessons/getForTeacher/:teacherId', ...getLessonsForTeacher)
  .get('/lessons/getForRoom/:classroomId', ...getLessonsForRoom)
  .get('/lessons/getForId/:lessonId', ...getLessonForId)
  // Cohort routes
  .get('/cohorts/getAllForTimetable/:timetableId', ...getCohortsForTimetable)
  // Teacher routes
  .get('/teachers/getAll', ...getTeachers)
  // Classroom routes
  .get('/classrooms/getAll', ...getClassrooms);
