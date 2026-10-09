import { oc } from '@orpc/contract';
import {
  importPayloadSchema,
  importSchema,
} from '../../domains/timetable/import';
import { filcRoute } from '../route';

/** Timetable XML import (Oman or aSc 2012). */
export const importContract = {
  import: oc
    .route(
      filcRoute({
        description: 'Import a timetable from an Oman or aSc 2012 XML file.',
        method: 'POST',
        operationId: 'postTimetableImport',
        path: '/timetable/import',
        successStatus: 200,
        tags: ['Timetable', 'Import'],
      })
    )
    .input(importSchema)
    .output(importPayloadSchema),
};
