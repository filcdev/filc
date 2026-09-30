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
  exportNavigatorRoute,
  importNavigatorRoute,
} from '#routes/navigator/transfer';
import {
  createTranslationRoute,
  deleteTranslationRoute,
  getTranslationBundleRoute,
  listTranslationLanguagesRoute,
  listTranslationsRoute,
  updateTranslationRoute,
} from '#routes/navigator/translations';

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
