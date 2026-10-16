import { curriculumRouter } from './_curriculum-router';
import { getCohortsForTimetable } from './cohort';
import { getGroupsForCohort, selectGroup } from './groups';
import { importRoute } from './import';
import {
  cleanupOrphanedCohortsHandler,
  deleteTimetable,
  getAllTimetables,
  getAllValidTimetables,
  getLatestValidTimetable,
  previewDeleteTimetable,
  updateTimetable,
} from './index';
import { getSubjects } from './lesson';
import { getPeriodsForTimetable } from './period';
import { getAvailableClassrooms, getClassrooms } from './room';
import {
  getMyTeacher,
  getTeachers,
  listTeachersAdmin,
  updateTeacher,
} from './teacher';

const timetables = {
  timetables: {
    cleanupOrphanedCohorts: cleanupOrphanedCohortsHandler,
    delete: deleteTimetable,
    latestValid: getLatestValidTimetable,
    list: getAllTimetables,
    previewDelete: previewDeleteTimetable,
    update: updateTimetable,
    valid: getAllValidTimetables,
  },
};

const importRouter = { import: importRoute };

const peopleRouter = {
  classrooms: {
    getAll: getClassrooms,
    getAvailable: getAvailableClassrooms,
  },
  cohorts: {
    getAllForTimetable: getCohortsForTimetable,
  },
  groups: {
    getForCohort: getGroupsForCohort,
    select: selectGroup,
  },
  periods: {
    getAll: getPeriodsForTimetable,
  },
  subjects: getSubjects,
  teachers: {
    getAll: getTeachers,
    list: listTeachersAdmin,
    me: getMyTeacher,
    update: updateTeacher,
  },
};

/**
 * Every `timetable.*` procedure, mirroring the contract's nesting: the
 * timetables themselves, the XML import, the people and rooms behind them, and
 * the curriculum taught in them.
 */
export const timetableRouter = {
  ...timetables,
  ...importRouter,
  ...peopleRouter,
  ...curriculumRouter,
};
