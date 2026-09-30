import { oc } from '@orpc/contract';
import z from 'zod';
import {
  buildingResponseSchema,
  buildingsResponseSchema,
  createBuildingSchema,
  updateBuildingSchema,
} from '../domains/navigator/building';
import {
  classroomResponseSchema,
  classroomsResponseSchema,
  createClassroomSchema,
  updateClassroomSchema,
} from '../domains/navigator/classroom';
import {
  classroomTypeResponseSchema,
  classroomTypesResponseSchema,
  createClassroomTypeSchema,
  updateClassroomTypeSchema,
} from '../domains/navigator/classroom-type';
import {
  corridorResponseSchema,
  corridorsResponseSchema,
  createCorridorSchema,
  updateCorridorSchema,
} from '../domains/navigator/corridor';
import { fullGraphSchema } from '../domains/navigator/graph';
import {
  createLiftSchema,
  liftResponseSchema,
  liftsResponseSchema,
  updateLiftSchema,
} from '../domains/navigator/lift';
import { navigatorIdParamsSchema } from '../domains/navigator/params';
import {
  createStairSchema,
  stairResponseSchema,
  stairsResponseSchema,
  updateStairSchema,
} from '../domains/navigator/stair';
import {
  navigatorImportResultSchema,
  navigatorImportUploadSchema,
} from '../domains/navigator/transfer';
import {
  createTranslationSchema,
  langQuerySchema,
  languagesResponseSchema,
  translationMapSchema,
  translationParamsSchema,
  translationResponseSchema,
  translationsResponseSchema,
  updateTranslationSchema,
} from '../domains/navigator/translation';
import { filcRoute } from './route';

/**
 * The campus navigator: the buildings, rooms, structures and translations the
 * 3D map and the kiosk build their scenes from, the public graph/bundle reads,
 * and the admin CRUD behind `navigator:manage`.
 */
export const navigatorContract = {
  buildings: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a campus building',
          group: 'Navigator',
          method: 'POST',
          operationId: 'postNavigatorBuildings',
          path: '/navigator/buildings',
          successStatus: 201,
          tags: ['Navigator'],
          type: '@unit Building',
        })
      )
      .input(createBuildingSchema)
      .output(buildingResponseSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Delete a campus building; its corridors, lifts and stairs cascade with it, but rooms still assigned to it refuse the delete',
          group: 'Navigator',
          method: 'DELETE',
          operationId: 'deleteNavigatorBuildingsById',
          path: '/navigator/buildings/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Building',
        })
      )
      .input(navigatorIdParamsSchema)
      .output(buildingResponseSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List the campus buildings',
          group: 'Navigator',
          method: 'GET',
          operationId: 'getNavigatorBuildings',
          path: '/navigator/buildings',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@listof Building',
        })
      )
      .output(buildingsResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a campus building',
          group: 'Navigator',
          method: 'PUT',
          operationId: 'putNavigatorBuildingsById',
          path: '/navigator/buildings/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Building',
        })
      )
      .input(navigatorIdParamsSchema.extend(updateBuildingSchema.shape))
      .output(buildingResponseSchema),
  },
  classrooms: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a classroom',
          group: 'Navigator',
          method: 'POST',
          operationId: 'postNavigatorClassrooms',
          path: '/navigator/classrooms',
          successStatus: 201,
          tags: ['Navigator'],
          type: '@unit Classroom',
        })
      )
      .input(createClassroomSchema)
      .output(classroomResponseSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Delete a classroom; rooms the timetable still uses are refused',
          group: 'Navigator',
          method: 'DELETE',
          operationId: 'deleteNavigatorClassroomsById',
          path: '/navigator/classrooms/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Classroom',
        })
      )
      .input(navigatorIdParamsSchema)
      .output(classroomResponseSchema),
    list: oc
      .route(
        filcRoute({
          description:
            'List the classrooms, including the ones the campus has not placed yet',
          group: 'Navigator',
          method: 'GET',
          operationId: 'getNavigatorClassrooms',
          path: '/navigator/classrooms',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@listof Classroom',
        })
      )
      .output(classroomsResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a classroom',
          group: 'Navigator',
          method: 'PUT',
          operationId: 'putNavigatorClassroomsById',
          path: '/navigator/classrooms/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Classroom',
        })
      )
      .input(navigatorIdParamsSchema.extend(updateClassroomSchema.shape))
      .output(classroomResponseSchema),
  },
  classroomTypes: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a classroom type',
          group: 'Navigator',
          method: 'POST',
          operationId: 'postNavigatorClassroomTypes',
          path: '/navigator/classroom-types',
          successStatus: 201,
          tags: ['Navigator'],
          type: '@unit ClassroomType',
        })
      )
      .input(createClassroomTypeSchema)
      .output(classroomTypeResponseSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Delete a classroom type; types still assigned to a classroom are refused',
          group: 'Navigator',
          method: 'DELETE',
          operationId: 'deleteNavigatorClassroomTypesById',
          path: '/navigator/classroom-types/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit ClassroomType',
        })
      )
      .input(navigatorIdParamsSchema)
      .output(classroomTypeResponseSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List the classroom types',
          group: 'Navigator',
          method: 'GET',
          operationId: 'getNavigatorClassroomTypes',
          path: '/navigator/classroom-types',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@listof ClassroomType',
        })
      )
      .output(classroomTypesResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a classroom type',
          group: 'Navigator',
          method: 'PUT',
          operationId: 'putNavigatorClassroomTypesById',
          path: '/navigator/classroom-types/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit ClassroomType',
        })
      )
      .input(navigatorIdParamsSchema.extend(updateClassroomTypeSchema.shape))
      .output(classroomTypeResponseSchema),
  },
  corridors: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a corridor',
          group: 'Navigator',
          method: 'POST',
          operationId: 'postNavigatorCorridors',
          path: '/navigator/corridors',
          successStatus: 201,
          tags: ['Navigator'],
          type: '@unit Corridor',
        })
      )
      .input(createCorridorSchema)
      .output(corridorResponseSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a corridor',
          group: 'Navigator',
          method: 'DELETE',
          operationId: 'deleteNavigatorCorridorsById',
          path: '/navigator/corridors/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Corridor',
        })
      )
      .input(navigatorIdParamsSchema)
      .output(corridorResponseSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List the corridors',
          group: 'Navigator',
          method: 'GET',
          operationId: 'getNavigatorCorridors',
          path: '/navigator/corridors',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@listof Corridor',
        })
      )
      .output(corridorsResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a corridor',
          group: 'Navigator',
          method: 'PUT',
          operationId: 'putNavigatorCorridorsById',
          path: '/navigator/corridors/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Corridor',
        })
      )
      .input(navigatorIdParamsSchema.extend(updateCorridorSchema.shape))
      .output(corridorResponseSchema),
  },
  export: oc
    .route(
      filcRoute({
        auth: true,
        description:
          'Export every navigator row (buildings, classroom types, classrooms, corridors, lifts, stairs and translations) as a versioned JSON payload.',
        group: 'Navigator',
        method: 'GET',
        operationId: 'getNavigatorExport',
        path: '/navigator/export',
        successStatus: 200,
        tags: ['Navigator'],
        type: '@unit NavigatorTransfer',
      })
    )
    .output(z.file()),
  graph: oc
    .route(
      filcRoute({
        description:
          'The whole campus graph in the upstream wire format, without a session. Only rows the campus has placed on the map appear.',
        group: 'Navigator',
        method: 'GET',
        operationId: 'getNavigatorGraph',
        path: '/navigator/graph',
        successStatus: 200,
        tags: ['Navigator'],
        type: '@unit FullGraph',
      })
    )
    .output(fullGraphSchema),
  import: oc
    .route(
      filcRoute({
        auth: true,
        description:
          'Insert or update every collection in a navigator export payload by its key, inside one transaction. Rows absent from the payload are never deleted.',
        group: 'Navigator',
        method: 'POST',
        operationId: 'postNavigatorImport',
        path: '/navigator/import',
        successStatus: 200,
        tags: ['Navigator'],
        type: '@unit NavigatorImport',
      })
    )
    .input(navigatorImportUploadSchema)
    .output(navigatorImportResultSchema),
  lifts: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a lift',
          group: 'Navigator',
          method: 'POST',
          operationId: 'postNavigatorLifts',
          path: '/navigator/lifts',
          successStatus: 201,
          tags: ['Navigator'],
          type: '@unit Lift',
        })
      )
      .input(createLiftSchema)
      .output(liftResponseSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a lift',
          group: 'Navigator',
          method: 'DELETE',
          operationId: 'deleteNavigatorLiftsById',
          path: '/navigator/lifts/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Lift',
        })
      )
      .input(navigatorIdParamsSchema)
      .output(liftResponseSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List the lifts',
          group: 'Navigator',
          method: 'GET',
          operationId: 'getNavigatorLifts',
          path: '/navigator/lifts',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@listof Lift',
        })
      )
      .output(liftsResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a lift',
          group: 'Navigator',
          method: 'PUT',
          operationId: 'putNavigatorLiftsById',
          path: '/navigator/lifts/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Lift',
        })
      )
      .input(navigatorIdParamsSchema.extend(updateLiftSchema.shape))
      .output(liftResponseSchema),
  },
  stairs: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a staircase',
          group: 'Navigator',
          method: 'POST',
          operationId: 'postNavigatorStairs',
          path: '/navigator/stairs',
          successStatus: 201,
          tags: ['Navigator'],
          type: '@unit Stair',
        })
      )
      .input(createStairSchema)
      .output(stairResponseSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a staircase',
          group: 'Navigator',
          method: 'DELETE',
          operationId: 'deleteNavigatorStairsById',
          path: '/navigator/stairs/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Stair',
        })
      )
      .input(navigatorIdParamsSchema)
      .output(stairResponseSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List the staircases',
          group: 'Navigator',
          method: 'GET',
          operationId: 'getNavigatorStairs',
          path: '/navigator/stairs',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@listof Stair',
        })
      )
      .output(stairsResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a staircase',
          group: 'Navigator',
          method: 'PUT',
          operationId: 'putNavigatorStairsById',
          path: '/navigator/stairs/{id}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Stair',
        })
      )
      .input(navigatorIdParamsSchema.extend(updateStairSchema.shape))
      .output(stairResponseSchema),
  },
  translations: {
    available: oc
      .route(
        filcRoute({
          description: 'List the languages the campus translations exist in',
          group: 'Navigator',
          method: 'GET',
          operationId: 'getNavigatorTranslationsAvailable',
          path: '/navigator/translations/available',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@listof Language',
        })
      )
      .output(languagesResponseSchema),
    create: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Create or replace one codename across every given language',
          group: 'Navigator',
          method: 'POST',
          operationId: 'postNavigatorTranslations',
          path: '/navigator/translations',
          successStatus: 201,
          tags: ['Navigator'],
          type: '@listof Translation',
        })
      )
      .input(createTranslationSchema)
      .output(translationsResponseSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete one codename in one language',
          group: 'Navigator',
          method: 'DELETE',
          operationId: 'deleteNavigatorTranslationsByLangByKey',
          path: '/navigator/translations/{lang}/{key}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Translation',
        })
      )
      .input(translationParamsSchema)
      .output(translationResponseSchema),
    lang: oc
      .route(
        filcRoute({
          description:
            'One language as a flat `text_key -> text` bundle, without a session',
          group: 'Navigator',
          method: 'GET',
          operationId: 'getNavigatorTranslationsLang',
          path: '/navigator/translations/lang',
          successStatus: 200,
          tags: ['Navigator'],
          type: 'TranslationBundle',
        })
      )
      .input(langQuerySchema)
      .output(translationMapSchema),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List every translation row',
          group: 'Navigator',
          method: 'GET',
          operationId: 'getNavigatorTranslations',
          path: '/navigator/translations',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@listof Translation',
        })
      )
      .output(translationsResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Write the text of one codename in one language',
          group: 'Navigator',
          method: 'PUT',
          operationId: 'putNavigatorTranslationsByLangByKey',
          path: '/navigator/translations/{lang}/{key}',
          successStatus: 200,
          tags: ['Navigator'],
          type: '@unit Translation',
        })
      )
      .input(translationParamsSchema.extend(updateTranslationSchema.shape))
      .output(translationResponseSchema),
  },
};
