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
import {
  createCorridorRoute,
  deleteCorridorRoute,
  listCorridorsRoute,
  updateCorridorRoute,
} from '#routes/navigator/corridors';
import { graphRoute } from '#routes/navigator/graph';
import {
  createLiftRoute,
  deleteLiftRoute,
  listLiftsRoute,
  updateLiftRoute,
} from '#routes/navigator/lifts';
import {
  createStairRoute,
  deleteStairRoute,
  listStairsRoute,
  updateStairRoute,
} from '#routes/navigator/stairs';
import {
  createTranslationRoute,
  deleteTranslationRoute,
  getTranslationRoute,
  listAvailableTranslationLangsRoute,
  listTranslationsByLangRoute,
  listTranslationsRoute,
  updateTranslationRoute,
} from '#routes/navigator/translations';

export const navigatorRouter = navigatorFactory
  .createApp()
  // Graph
  .get('/graph', ...graphRoute)
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
  // Corridors
  .get('/corridors', ...listCorridorsRoute)
  .post('/corridors', ...createCorridorRoute)
  .put('/corridors/:id', ...updateCorridorRoute)
  .delete('/corridors/:id', ...deleteCorridorRoute)
  // Lifts
  .get('/lifts', ...listLiftsRoute)
  .post('/lifts', ...createLiftRoute)
  .put('/lifts/:id', ...updateLiftRoute)
  .delete('/lifts/:id', ...deleteLiftRoute)
  // Stairs
  .get('/stairs', ...listStairsRoute)
  .post('/stairs', ...createStairRoute)
  .put('/stairs/:id', ...updateStairRoute)
  .delete('/stairs/:id', ...deleteStairRoute)
  // Translations (public reads first, then auth CRUD)
  .get('/translations/lang', ...listTranslationsByLangRoute)
  .get('/translations/available', ...listAvailableTranslationLangsRoute)
  .get('/translations', ...listTranslationsRoute)
  .post('/translations', ...createTranslationRoute)
  .get('/translations/:lang/:key', ...getTranslationRoute)
  .put('/translations/:lang/:key', ...updateTranslationRoute)
  .delete('/translations/:lang/:key', ...deleteTranslationRoute);
