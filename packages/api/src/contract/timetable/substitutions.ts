import { oc } from '@orpc/contract';
import z from 'zod';
import { dateRangeQuerySchema } from '../../domains/timetable/export';
import {
  cohortIdParamsSchema,
  createSubstitutionSchema,
  manualCreateSchema,
  substitutionIdParamsSchema,
  substitutionRowSchema,
  substitutionsByCohortSchema,
  substitutionWithLessonIdsSchema,
  substitutionWithRelationsSchema,
  updateSubstitutionSchema,
} from '../../domains/timetable/substitution';
import { filcRoute } from '../route';

const substitutionWithRelationsType =
  '@listof SubstitutionWithRelations @field(.substitution, Substitution) @field(.teacher, Teacher) @field(.lessons, List<String>)';

export const substitutionsContract = {
  substitutions: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new substitution',
          group: 'Substitution',
          method: 'POST',
          operationId: 'postTimetableSubstitutions',
          path: '/timetable/substitutions',
          successStatus: 200,
          tags: ['Substitution'],
          type: '@unit Substitution',
        })
      )
      .input(createSubstitutionSchema)
      .output(substitutionRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a substitution',
          group: 'Substitution',
          method: 'DELETE',
          operationId: 'deleteTimetableSubstitutionsById',
          path: '/timetable/substitutions/{id}',
          successStatus: 200,
          tags: ['Substitution'],
          type: '@nodata',
        })
      )
      .input(substitutionIdParamsSchema)
      .output(z.object({ id: z.string() })),
    export: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Export substitutions as a CSV file over an optional date range.',
          group: 'Substitution',
          method: 'GET',
          operationId: 'getTimetableSubstitutionsExport',
          path: '/timetable/substitutions/export',
          successStatus: 200,
          tags: ['Substitution'],
          type: 'Export substitutions as CSV',
        })
      )
      .input(dateRangeQuerySchema)
      .output(z.file()),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get all substitutions from the database.',
          group: 'Substitution',
          method: 'GET',
          operationId: 'getTimetableSubstitutions',
          path: '/timetable/substitutions',
          successStatus: 200,
          tags: ['Substitution'],
          type: substitutionWithRelationsType,
        })
      )
      .output(substitutionWithRelationsSchema.array()),
    manual: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Create a substitution manually by specifying the teacher, lesson time, subject and cohort directly.',
          group: 'Substitution',
          method: 'POST',
          operationId: 'postTimetableSubstitutionsManual',
          path: '/timetable/substitutions/manual',
          successStatus: 200,
          tags: ['Substitution'],
          type: '@unit Substitution',
        })
      )
      .input(manualCreateSchema)
      .output(substitutionRowSchema),
    relevant: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get relevant substitutions from the database.',
          group: 'Substitution',
          method: 'GET',
          operationId: 'getTimetableSubstitutionsRelevant',
          path: '/timetable/substitutions/relevant',
          successStatus: 200,
          tags: ['Substitution'],
          type: substitutionWithRelationsType,
        })
      )
      .output(substitutionWithLessonIdsSchema.array()),
    relevantForCohort: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Get relevant substitutions for a given cohort from the database.',
          group: 'Substitution',
          method: 'GET',
          operationId: 'getTimetableSubstitutionsCohortByCohortId',
          path: '/timetable/substitutions/cohort/{cohortId}',
          successStatus: 200,
          tags: ['Substitution'],
          type: '@unit SubstitutionsByCohort @field(.substitutions, List<SubstitutionWithRelations>)',
        })
      )
      .input(cohortIdParamsSchema)
      .output(substitutionsByCohortSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a substitution',
          group: 'Substitution',
          method: 'PUT',
          operationId: 'putTimetableSubstitutionsById',
          path: '/timetable/substitutions/{id}',
          successStatus: 200,
          tags: ['Substitution'],
          type: '@unit Substitution',
        })
      )
      .input(substitutionIdParamsSchema.extend(updateSubstitutionSchema.shape))
      .output(substitutionRowSchema),
  },
};
