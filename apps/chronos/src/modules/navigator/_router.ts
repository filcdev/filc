import {
  createBuildingRoute,
  deleteBuildingRoute,
  listBuildingsRoute,
  updateBuildingRoute,
} from '#modules/navigator/buildings';
import {
  createClassroomTypeRoute,
  deleteClassroomTypeRoute,
  listClassroomTypesRoute,
  updateClassroomTypeRoute,
} from '#modules/navigator/classroom-types';
import {
  createClassroomRoute,
  deleteClassroomRoute,
  listClassroomsRoute,
  updateClassroomRoute,
} from '#modules/navigator/classrooms';
import {
  createCorridorRoute,
  deleteCorridorRoute,
  listCorridorsRoute,
  updateCorridorRoute,
} from '#modules/navigator/corridors';
import { graphRoute } from '#modules/navigator/graph';
import {
  createLiftRoute,
  deleteLiftRoute,
  listLiftsRoute,
  updateLiftRoute,
} from '#modules/navigator/lifts';
import {
  createStairRoute,
  deleteStairRoute,
  listStairsRoute,
  updateStairRoute,
} from '#modules/navigator/stairs';
import {
  exportNavigatorRoute,
  importNavigatorRoute,
} from '#modules/navigator/transfer';
import {
  createTranslationRoute,
  deleteTranslationRoute,
  getTranslationBundleRoute,
  listTranslationLanguagesRoute,
  listTranslationsRoute,
  updateTranslationRoute,
} from '#modules/navigator/translations';

export const navigatorRouter = {
  buildings: {
    create: createBuildingRoute,
    delete: deleteBuildingRoute,
    list: listBuildingsRoute,
    update: updateBuildingRoute,
  },
  classrooms: {
    create: createClassroomRoute,
    delete: deleteClassroomRoute,
    list: listClassroomsRoute,
    update: updateClassroomRoute,
  },
  classroomTypes: {
    create: createClassroomTypeRoute,
    delete: deleteClassroomTypeRoute,
    list: listClassroomTypesRoute,
    update: updateClassroomTypeRoute,
  },
  corridors: {
    create: createCorridorRoute,
    delete: deleteCorridorRoute,
    list: listCorridorsRoute,
    update: updateCorridorRoute,
  },
  export: exportNavigatorRoute,
  graph: graphRoute,
  import: importNavigatorRoute,
  lifts: {
    create: createLiftRoute,
    delete: deleteLiftRoute,
    list: listLiftsRoute,
    update: updateLiftRoute,
  },
  stairs: {
    create: createStairRoute,
    delete: deleteStairRoute,
    list: listStairsRoute,
    update: updateStairRoute,
  },
  translations: {
    available: listTranslationLanguagesRoute,
    create: createTranslationRoute,
    delete: deleteTranslationRoute,
    lang: getTranslationBundleRoute,
    list: listTranslationsRoute,
    update: updateTranslationRoute,
  },
};
