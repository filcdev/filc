import { oc } from '@orpc/contract';
import z from 'zod';
import { listResponse } from '../../domains/list';
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

export const substitutionsContract = {
  substitutions: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new substitution',
          method: 'POST',
          operationId: 'postTimetableSubstitutions',
          path: '/timetable/substitutions',
          tags: ['Substitution'],
        })
      )
      .input(createSubstitutionSchema)
      .output(substitutionRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a substitution',
          method: 'DELETE',
          operationId: 'deleteTimetableSubstitutionsById',
          path: '/timetable/substitutions/{id}',
          tags: ['Substitution'],
        })
      )
      .input(substitutionIdParamsSchema)
      .output(z.object({ id: z.uuid() })),
    export: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Export substitutions as a CSV file over an optional date range.',
          method: 'GET',
          operationId: 'getTimetableSubstitutionsExport',
          path: '/timetable/substitutions/export',
          tags: ['Substitution'],
        })
      )
      .input(dateRangeQuerySchema)
      .output(z.file()),
    list: oc
      .route(
        filcRoute({
          description: 'Get all substitutions from the database.',
          method: 'GET',
          operationId: 'getTimetableSubstitutions',
          path: '/timetable/substitutions',
          tags: ['Substitution'],
        })
      )
      .output(listResponse(substitutionWithRelationsSchema)),
    manual: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Create a substitution manually by specifying the teacher, lesson time, subject and cohort directly.',
          method: 'POST',
          operationId: 'postTimetableSubstitutionsManual',
          path: '/timetable/substitutions/manual',
          tags: ['Substitution'],
        })
      )
      .input(manualCreateSchema)
      .output(substitutionRowSchema),
    relevant: oc
      .route(
        filcRoute({
          description: 'Get relevant substitutions from the database.',
          method: 'GET',
          operationId: 'getTimetableSubstitutionsRelevant',
          path: '/timetable/substitutions/relevant',
          tags: ['Substitution'],
        })
      )
      .output(listResponse(substitutionWithLessonIdsSchema)),
    relevantForCohort: oc
      .route(
        filcRoute({
          description:
            'Get relevant substitutions for a given cohort from the database.',
          method: 'GET',
          operationId: 'getTimetableSubstitutionsCohortByCohortId',
          path: '/timetable/substitutions/cohort/{cohortId}',
          tags: ['Substitution'],
        })
      )
      .input(cohortIdParamsSchema)
      .output(substitutionsByCohortSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a substitution',
          method: 'PUT',
          operationId: 'putTimetableSubstitutionsById',
          path: '/timetable/substitutions/{id}',
          tags: ['Substitution'],
        })
      )
      .input(substitutionIdParamsSchema.extend(updateSubstitutionSchema.shape))
      .output(substitutionRowSchema),
  },
};
