import { exportMovedLessonsRoute, exportSubstitutionsRoute } from './export';
import {
  getLessonForId,
  getLessonsForCohort,
  getLessonsForRoom,
  getLessonsForTeacher,
  getLessonsForTeachers,
  getSubstitutionCandidates,
} from './lesson';
import {
  createMovedLesson,
  deleteMovedLesson,
  getAllMovedLessons,
  getMovedLessonsForCohort,
  getRelevantMovedLessons,
  getRelevantMovedLessonsForCohort,
  updateMovedLesson,
} from './moved-lesson';
import {
  createManualSubstitution,
  createSubstitution,
  deleteSubstitution,
  getAllSubstitutions,
  getRelevantSubstitutions,
  getRelevantSubstitutionsForCohort,
  updateSubstitution,
} from './substitution';

/**
 * The lesson/substitution/moved-lesson half of the timetable feature: the
 * implementations for `lessonsContract`, `substitutionsContract` and
 * `movedLessonsContract`, keyed exactly like the contract so `_router.ts` can
 * spread it into the assembled timetable router.
 */
export const curriculumRouter = {
  lessons: {
    getForCohort: getLessonsForCohort,
    getForId: getLessonForId,
    getForRoom: getLessonsForRoom,
    getForTeacher: getLessonsForTeacher,
    getForTeachers: getLessonsForTeachers,
    getSubstitutionCandidates,
  },
  movedLessons: {
    create: createMovedLesson,
    delete: deleteMovedLesson,
    export: exportMovedLessonsRoute,
    forCohort: getMovedLessonsForCohort,
    list: getAllMovedLessons,
    relevant: getRelevantMovedLessons,
    relevantForCohort: getRelevantMovedLessonsForCohort,
    update: updateMovedLesson,
  },
  substitutions: {
    create: createSubstitution,
    delete: deleteSubstitution,
    export: exportSubstitutionsRoute,
    list: getAllSubstitutions,
    manual: createManualSubstitution,
    relevant: getRelevantSubstitutions,
    relevantForCohort: getRelevantSubstitutionsForCohort,
    update: updateSubstitution,
  },
};
