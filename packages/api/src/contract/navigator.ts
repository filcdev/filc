import { oc } from '@orpc/contract';
import z from 'zod';
import { listResponse } from '../domains/list';
import {
  buildingRowSchema,
  createBuildingSchema,
  updateBuildingSchema,
} from '../domains/navigator/building';
import {
  classroomRowSchema,
  createClassroomSchema,
  updateClassroomSchema,
} from '../domains/navigator/classroom';
import {
  classroomTypeRowSchema,
  createClassroomTypeSchema,
  updateClassroomTypeSchema,
} from '../domains/navigator/classroom-type';
import {
  corridorRowSchema,
  createCorridorSchema,
  updateCorridorSchema,
} from '../domains/navigator/corridor';
import { fullGraphSchema } from '../domains/navigator/graph';
import {
  createLiftSchema,
  liftRowSchema,
  updateLiftSchema,
} from '../domains/navigator/lift';
import { navigatorIdParamsSchema } from '../domains/navigator/params';
import {
  createStairSchema,
  stairRowSchema,
  updateStairSchema,
} from '../domains/navigator/stair';
import {
  navigatorImportResultSchema,
  navigatorImportUploadSchema,
} from '../domains/navigator/transfer';
import {
  createTranslationSchema,
  langQuerySchema,
  languageSchema,
  translationMapSchema,
  translationParamsSchema,
  translationSchema,
  updateTranslationSchema,
} from '../domains/navigator/translation';
import { filcRoute } from './route';

const deleteResponseSchema = z.object({ id: z.string() });

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
          method: 'POST',
          operationId: 'postNavigatorBuildings',
          path: '/navigator/buildings',
          successStatus: 201,
          tags: ['Navigator'],
        })
      )
      .input(createBuildingSchema)
      .output(buildingRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Delete a campus building; its corridors, lifts and stairs cascade with it, but rooms still assigned to it refuse the delete',
          method: 'DELETE',
          operationId: 'deleteNavigatorBuildingsById',
          path: '/navigator/buildings/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema)
      .output(deleteResponseSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List the campus buildings',
          method: 'GET',
          operationId: 'getNavigatorBuildings',
          path: '/navigator/buildings',
          tags: ['Navigator'],
        })
      )
      .output(listResponse(buildingRowSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a campus building',
          method: 'PUT',
          operationId: 'putNavigatorBuildingsById',
          path: '/navigator/buildings/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema.extend(updateBuildingSchema.shape))
      .output(buildingRowSchema),
  },
  classrooms: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a classroom',
          method: 'POST',
          operationId: 'postNavigatorClassrooms',
          path: '/navigator/classrooms',
          successStatus: 201,
          tags: ['Navigator'],
        })
      )
      .input(createClassroomSchema)
      .output(classroomRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Delete a classroom; rooms the timetable still uses are refused',
          method: 'DELETE',
          operationId: 'deleteNavigatorClassroomsById',
          path: '/navigator/classrooms/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema)
      .output(deleteResponseSchema),
    list: oc
      .route(
        filcRoute({
          description:
            'List the classrooms, including the ones the campus has not placed yet',
          method: 'GET',
          operationId: 'getNavigatorClassrooms',
          path: '/navigator/classrooms',
          tags: ['Navigator'],
        })
      )
      .output(listResponse(classroomRowSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a classroom',
          method: 'PUT',
          operationId: 'putNavigatorClassroomsById',
          path: '/navigator/classrooms/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema.extend(updateClassroomSchema.shape))
      .output(classroomRowSchema),
  },
  classroomTypes: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a classroom type',
          method: 'POST',
          operationId: 'postNavigatorClassroomTypes',
          path: '/navigator/classroom-types',
          successStatus: 201,
          tags: ['Navigator'],
        })
      )
      .input(createClassroomTypeSchema)
      .output(classroomTypeRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Delete a classroom type; types still assigned to a classroom are refused',
          method: 'DELETE',
          operationId: 'deleteNavigatorClassroomTypesById',
          path: '/navigator/classroom-types/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema)
      .output(deleteResponseSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List the classroom types',
          method: 'GET',
          operationId: 'getNavigatorClassroomTypes',
          path: '/navigator/classroom-types',
          tags: ['Navigator'],
        })
      )
      .output(listResponse(classroomTypeRowSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a classroom type',
          method: 'PUT',
          operationId: 'putNavigatorClassroomTypesById',
          path: '/navigator/classroom-types/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema.extend(updateClassroomTypeSchema.shape))
      .output(classroomTypeRowSchema),
  },
  corridors: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a corridor',
          method: 'POST',
          operationId: 'postNavigatorCorridors',
          path: '/navigator/corridors',
          successStatus: 201,
          tags: ['Navigator'],
        })
      )
      .input(createCorridorSchema)
      .output(corridorRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a corridor',
          method: 'DELETE',
          operationId: 'deleteNavigatorCorridorsById',
          path: '/navigator/corridors/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema)
      .output(deleteResponseSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List the corridors',
          method: 'GET',
          operationId: 'getNavigatorCorridors',
          path: '/navigator/corridors',
          tags: ['Navigator'],
        })
      )
      .output(listResponse(corridorRowSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a corridor',
          method: 'PUT',
          operationId: 'putNavigatorCorridorsById',
          path: '/navigator/corridors/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema.extend(updateCorridorSchema.shape))
      .output(corridorRowSchema),
  },
  export: oc
    .route(
      filcRoute({
        auth: true,
        description:
          'Export every navigator row (buildings, classroom types, classrooms, corridors, lifts, stairs and translations) as a versioned JSON payload.',
        method: 'GET',
        operationId: 'getNavigatorExport',
        path: '/navigator/export',
        tags: ['Navigator'],
      })
    )
    .output(z.file()),
  graph: oc
    .route(
      filcRoute({
        description:
          'The whole campus graph in the upstream wire format, without a session. Only rows the campus has placed on the map appear.',
        method: 'GET',
        operationId: 'getNavigatorGraph',
        path: '/navigator/graph',
        tags: ['Navigator'],
      })
    )
    .output(fullGraphSchema),
  import: oc
    .route(
      filcRoute({
        auth: true,
        description:
          'Insert or update every collection in a navigator export payload by its key, inside one transaction. Rows absent from the payload are never deleted.',
        method: 'POST',
        operationId: 'postNavigatorImport',
        path: '/navigator/import',
        tags: ['Navigator'],
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
          method: 'POST',
          operationId: 'postNavigatorLifts',
          path: '/navigator/lifts',
          successStatus: 201,
          tags: ['Navigator'],
        })
      )
      .input(createLiftSchema)
      .output(liftRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a lift',
          method: 'DELETE',
          operationId: 'deleteNavigatorLiftsById',
          path: '/navigator/lifts/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema)
      .output(deleteResponseSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List the lifts',
          method: 'GET',
          operationId: 'getNavigatorLifts',
          path: '/navigator/lifts',
          tags: ['Navigator'],
        })
      )
      .output(listResponse(liftRowSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a lift',
          method: 'PUT',
          operationId: 'putNavigatorLiftsById',
          path: '/navigator/lifts/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema.extend(updateLiftSchema.shape))
      .output(liftRowSchema),
  },
  stairs: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a staircase',
          method: 'POST',
          operationId: 'postNavigatorStairs',
          path: '/navigator/stairs',
          successStatus: 201,
          tags: ['Navigator'],
        })
      )
      .input(createStairSchema)
      .output(stairRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a staircase',
          method: 'DELETE',
          operationId: 'deleteNavigatorStairsById',
          path: '/navigator/stairs/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema)
      .output(deleteResponseSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List the staircases',
          method: 'GET',
          operationId: 'getNavigatorStairs',
          path: '/navigator/stairs',
          tags: ['Navigator'],
        })
      )
      .output(listResponse(stairRowSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a staircase',
          method: 'PUT',
          operationId: 'putNavigatorStairsById',
          path: '/navigator/stairs/{id}',
          tags: ['Navigator'],
        })
      )
      .input(navigatorIdParamsSchema.extend(updateStairSchema.shape))
      .output(stairRowSchema),
  },
  translations: {
    available: oc
      .route(
        filcRoute({
          description: 'List the languages the campus translations exist in',
          method: 'GET',
          operationId: 'getNavigatorTranslationsAvailable',
          path: '/navigator/translations/available',
          tags: ['Navigator'],
        })
      )
      .output(listResponse(languageSchema)),
    create: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Create or replace one codename across every given language',
          method: 'POST',
          operationId: 'postNavigatorTranslations',
          path: '/navigator/translations',
          successStatus: 201,
          tags: ['Navigator'],
        })
      )
      .input(createTranslationSchema)
      .output(listResponse(translationSchema)),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete one codename in one language',
          method: 'DELETE',
          operationId: 'deleteNavigatorTranslationsByLangByKey',
          path: '/navigator/translations/{lang}/{key}',
          tags: ['Navigator'],
        })
      )
      .input(translationParamsSchema)
      .output(deleteResponseSchema),
    lang: oc
      .route(
        filcRoute({
          description:
            'One language as a flat `text_key -> text` bundle, without a session',
          method: 'GET',
          operationId: 'getNavigatorTranslationsLang',
          path: '/navigator/translations/lang',
          tags: ['Navigator'],
        })
      )
      .input(langQuerySchema)
      .output(translationMapSchema),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List every translation row',
          method: 'GET',
          operationId: 'getNavigatorTranslations',
          path: '/navigator/translations',
          tags: ['Navigator'],
        })
      )
      .output(listResponse(translationSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Write the text of one codename in one language',
          method: 'PUT',
          operationId: 'putNavigatorTranslationsByLangByKey',
          path: '/navigator/translations/{lang}/{key}',
          tags: ['Navigator'],
        })
      )
      .input(translationParamsSchema.extend(updateTranslationSchema.shape))
      .output(translationSchema),
  },
};
