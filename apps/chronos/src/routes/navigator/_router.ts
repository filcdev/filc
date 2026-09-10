import { navigatorFactory } from '#routes/navigator/_factory';
import {
  createBuildingRoute,
  deleteBuildingRoute,
  listBuildingsRoute,
  updateBuildingRoute,
} from '#routes/navigator/buildings';
import {
  createClassroomTypeRoute,
  deleteClassroomTypeRoute,
  listClassroomTypesRoute,
  updateClassroomTypeRoute,
} from '#routes/navigator/classroom-types';
import {
  createClassroomRoute,
  deleteClassroomRoute,
  listClassroomsRoute,
  updateClassroomRoute,
} from '#routes/navigator/classrooms';
import { graphRoute } from '#routes/navigator/graph';
import {
  exportNavigatorRoute,
  importNavigatorRoute,
} from '#routes/navigator/transfer';
import {
  createTranslationRoute,
  deleteTranslationRoute,
  getTranslationRoute,
  listAvailableTranslationLangsRoute,
  listTranslationsByLangRoute,
  listTranslationsRoute,
  updateTranslationRoute,
} from '#routes/navigator/translations';
import {
  createUtilityRoute,
  deleteUtilityRoute,
  getUtilityRoute,
  listUtilitiesRoute,
  updateUtilityRoute,
} from '#routes/navigator/utilities';

export const navigatorRouter = navigatorFactory
  .createApp()
  // Graph
  .get('/graph', ...graphRoute)
  // Transfer (export/import)
  .get('/export', ...exportNavigatorRoute)
  .post('/import', ...importNavigatorRoute)
  // Buildings
  .get('/buildings', ...listBuildingsRoute)
  .post('/buildings', ...createBuildingRoute)
  .put('/buildings/:id', ...updateBuildingRoute)
  .delete('/buildings/:id', ...deleteBuildingRoute)
  // Classroom types
  .get('/classroom-types', ...listClassroomTypesRoute)
  .post('/classroom-types', ...createClassroomTypeRoute)
  .put('/classroom-types/:id', ...updateClassroomTypeRoute)
  .delete('/classroom-types/:id', ...deleteClassroomTypeRoute)
  // Classrooms
  .get('/classrooms', ...listClassroomsRoute)
  .post('/classrooms', ...createClassroomRoute)
  .put('/classrooms/:id', ...updateClassroomRoute)
  .delete('/classrooms/:id', ...deleteClassroomRoute)
  // Utilities
  .get('/utilities', ...listUtilitiesRoute)
  .post('/utilities', ...createUtilityRoute)
  .get('/utilities/:id', ...getUtilityRoute)
  .put('/utilities/:id', ...updateUtilityRoute)
  .delete('/utilities/:id', ...deleteUtilityRoute)
  // Translations (public reads first, then auth CRUD)
  .get('/translations/lang', ...listTranslationsByLangRoute)
  .get('/translations/available', ...listAvailableTranslationLangsRoute)
  .get('/translations', ...listTranslationsRoute)
  .post('/translations', ...createTranslationRoute)
  .get('/translations/:lang/:key', ...getTranslationRoute)
  .put('/translations/:lang/:key', ...updateTranslationRoute)
  .delete('/translations/:lang/:key', ...deleteTranslationRoute);
