import { timetableFactory } from '#routes/timetable/_factory';
import { getCohortsForTimetable } from '#routes/timetable/cohort';
import {
  exportMovedLessonsRoute,
  exportSubstitutionsRoute,
} from '#routes/timetable/export';
import { getGroupsForCohort, selectGroup } from '#routes/timetable/groups';
import { importRoute } from '#routes/timetable/import';
import {
  cleanupOrphanedCohortsHandler,
  deleteTimetable,
  getAllTimetables,
  getAllValidTimetables,
  getLatestValidTimetable,
  previewDeleteTimetable,
  updateTimetable,
} from '#routes/timetable/index';
import {
  getLessonForId,
  getLessonsForCohort,
  getLessonsForRoom,
  getLessonsForTeacher,
  getLessonsForTeachers,
  getSubjects,
  getSubstitutionCandidates,
} from '#routes/timetable/lesson';
import {
  buildingCrud,
  classroomCrud,
  dayDefinitionCrud,
  periodCrud,
  subjectCrud,
  termDefinitionCrud,
  weekDefinitionCrud,
} from '#routes/timetable/master-data';
import {
  createMovedLesson,
  deleteMovedLesson,
  getAllMovedLessons,
  getMovedLessonsForCohort,
  getRelevantMovedLessons,
  getRelevantMovedLessonsForCohort,
  updateMovedLesson,
} from '#routes/timetable/moved-lesson';
import { getPeriodsForTimetable } from '#routes/timetable/period';
import {
  createManualSubstitution,
  createSubstitution,
  deleteSubstitution,
  getAllSubstitutions,
  getRelevantSubstitutions,
  getRelevantSubstitutionsForCohort,
  updateSubstitution,
} from '#routes/timetable/substitution';
import { getAvailableClassrooms, getClassrooms } from './room';
import { getTeachers } from './teacher';

export const timetableRouter = timetableFactory
  .createApp()
  // Timetable routes
  .get('/timetables', ...getAllTimetables)
  .get('/timetables/latestValid', ...getLatestValidTimetable)
  .get('/timetables/valid', ...getAllValidTimetables)
  .patch('/timetables/:id', ...updateTimetable)
  .get('/timetables/:id/preview-delete', ...previewDeleteTimetable)
  .delete('/timetables/:id', ...deleteTimetable)
  .post(
    '/timetables/cleanup-orphaned-cohorts',
    ...cleanupOrphanedCohortsHandler
  )
  .post('/import', ...importRoute)
  // Substitution routes
  .get('/substitutions', ...getAllSubstitutions)
  .get('/substitutions/relevant', ...getRelevantSubstitutions)
  .get('/substitutions/export', ...exportSubstitutionsRoute)
  .get('/substitutions/cohort/:cohortId', ...getRelevantSubstitutionsForCohort)
  .post('/substitutions', ...createSubstitution)
  .post('/substitutions/manual', ...createManualSubstitution)
  .put('/substitutions/:id', ...updateSubstitution)
  .delete('/substitutions/:id', ...deleteSubstitution)
  // Moved lesson routes
  .get('/movedLessons', ...getAllMovedLessons)
  .get('/movedLessons/relevant', ...getRelevantMovedLessons)
  .get('/movedLessons/export', ...exportMovedLessonsRoute)
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
  .post('/lessons/getForTeachers', ...getLessonsForTeachers)
  .post('/lessons/getSubstitutionCandidates', ...getSubstitutionCandidates)
  .get('/lessons/getForRoom/:classroomId', ...getLessonsForRoom)
  .get('/lessons/getForId/:lessonId', ...getLessonForId)
  .get('/subjects', ...getSubjects)
  // Period routes
  .get('/periods/getAll', ...getPeriodsForTimetable)
  // Classroom routes
  .get('/classrooms/getAvailable', ...getAvailableClassrooms)
  .get('/classrooms/getAll', ...getClassrooms)
  // Cohort routes
  .get('/cohorts/getAllForTimetable/:timetableId', ...getCohortsForTimetable)
  // Group routes
  .get('/groups/getForCohort/:cohortId', ...getGroupsForCohort)
  .post('/groups/select', ...selectGroup)
  // Teacher routes
  .get('/teachers/getAll', ...getTeachers)
  // Base-data CRUD (managed under /manage to avoid clashing with public reads)
  .get('/manage/subjects', ...subjectCrud.list)
  .post('/manage/subjects', ...subjectCrud.create)
  .get('/manage/subjects/:id', ...subjectCrud.getById)
  .patch('/manage/subjects/:id', ...subjectCrud.update)
  .delete('/manage/subjects/:id', ...subjectCrud.remove)
  .get('/manage/buildings', ...buildingCrud.list)
  .post('/manage/buildings', ...buildingCrud.create)
  .get('/manage/buildings/:id', ...buildingCrud.getById)
  .patch('/manage/buildings/:id', ...buildingCrud.update)
  .delete('/manage/buildings/:id', ...buildingCrud.remove)
  .get('/manage/classrooms', ...classroomCrud.list)
  .post('/manage/classrooms', ...classroomCrud.create)
  .get('/manage/classrooms/:id', ...classroomCrud.getById)
  .patch('/manage/classrooms/:id', ...classroomCrud.update)
  .delete('/manage/classrooms/:id', ...classroomCrud.remove)
  .get('/manage/periods', ...periodCrud.list)
  .post('/manage/periods', ...periodCrud.create)
  .get('/manage/periods/:id', ...periodCrud.getById)
  .patch('/manage/periods/:id', ...periodCrud.update)
  .delete('/manage/periods/:id', ...periodCrud.remove)
  .get('/manage/dayDefinitions', ...dayDefinitionCrud.list)
  .post('/manage/dayDefinitions', ...dayDefinitionCrud.create)
  .get('/manage/dayDefinitions/:id', ...dayDefinitionCrud.getById)
  .patch('/manage/dayDefinitions/:id', ...dayDefinitionCrud.update)
  .delete('/manage/dayDefinitions/:id', ...dayDefinitionCrud.remove)
  .get('/manage/weekDefinitions', ...weekDefinitionCrud.list)
  .post('/manage/weekDefinitions', ...weekDefinitionCrud.create)
  .get('/manage/weekDefinitions/:id', ...weekDefinitionCrud.getById)
  .patch('/manage/weekDefinitions/:id', ...weekDefinitionCrud.update)
  .delete('/manage/weekDefinitions/:id', ...weekDefinitionCrud.remove)
  .get('/manage/termDefinitions', ...termDefinitionCrud.list)
  .post('/manage/termDefinitions', ...termDefinitionCrud.create)
  .get('/manage/termDefinitions/:id', ...termDefinitionCrud.getById)
  .patch('/manage/termDefinitions/:id', ...termDefinitionCrud.update)
  .delete('/manage/termDefinitions/:id', ...termDefinitionCrud.remove);
