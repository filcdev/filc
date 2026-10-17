import { oc } from '@orpc/contract';
import z from 'zod';
import {
  cardListResponseSchema,
  createCardSchema,
  doorlockCardSchema,
  doorlockUserListResponseSchema,
  updateCardSchema,
} from '../domains/doorlock/cards';
import {
  deviceListResponseSchema,
  devicePayloadSchema,
  doorlockDeviceSchema,
  idParamSchema,
  idResponseSchema,
} from '../domains/doorlock/devices';
import { exportQuerySchema } from '../domains/doorlock/export';
import {
  doorlockAuditLogSchema,
  doorlockLogListResponseSchema,
  logsQuerySchema,
} from '../domains/doorlock/logs';
import { otaPayloadSchema } from '../domains/doorlock/ota';
import {
  activateVirtualCardSchema,
  updateFrozenSchema,
} from '../domains/doorlock/self';
import {
  deviceStatsResponseSchema,
  doorlockStatsResponseSchema,
} from '../domains/doorlock/stats';
import { filcRoute } from './route';

const TAGS = ['Doorlock'];

export const doorlockContract = {
  cards: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new access card',
          method: 'POST',
          operationId: 'postDoorlockCards',
          path: '/doorlock/cards',
          successStatus: 201,
          tags: TAGS,
        })
      )
      .input(createCardSchema)
      .output(doorlockCardSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete an access card',
          method: 'DELETE',
          operationId: 'deleteDoorlockCardsById',
          path: '/doorlock/cards/{id}',
          tags: TAGS,
        })
      )
      .input(idParamSchema)
      .output(idResponseSchema),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List all access cards',
          method: 'GET',
          operationId: 'getDoorlockCards',
          path: '/doorlock/cards',
          tags: TAGS,
        })
      )
      .output(cardListResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update an access card',
          method: 'PUT',
          operationId: 'putDoorlockCardsById',
          path: '/doorlock/cards/{id}',
          tags: TAGS,
        })
      )
      .input(updateCardSchema.extend(idParamSchema.shape))
      .output(doorlockCardSchema),
    users: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List users eligible for card ownership',
          method: 'GET',
          operationId: 'getDoorlockCardsUsers',
          path: '/doorlock/cards/users',
          tags: TAGS,
        })
      )
      .output(doorlockUserListResponseSchema),
  },
  devices: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new doorlock device',
          method: 'POST',
          operationId: 'postDoorlockDevices',
          path: '/doorlock/devices',
          successStatus: 201,
          tags: TAGS,
        })
      )
      .input(devicePayloadSchema)
      .output(doorlockDeviceSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a doorlock device',
          method: 'DELETE',
          operationId: 'deleteDoorlockDevicesById',
          path: '/doorlock/devices/{id}',
          tags: TAGS,
        })
      )
      .input(idParamSchema)
      .output(idResponseSchema),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List all doorlock devices',
          method: 'GET',
          operationId: 'getDoorlockDevices',
          path: '/doorlock/devices',
          tags: TAGS,
        })
      )
      .output(deviceListResponseSchema),
    stats: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get device health statistics',
          method: 'GET',
          operationId: 'getDoorlockDevicesByIdStats',
          path: '/doorlock/devices/{id}/stats',
          tags: TAGS,
        })
      )
      .input(idParamSchema)
      .output(deviceStatsResponseSchema),
    triggerOta: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Trigger an OTA update on a specific device',
          method: 'POST',
          operationId: 'postDoorlockDevicesByIdUpdate',
          path: '/doorlock/devices/{id}/update',
          tags: TAGS,
        })
      )
      .input(idParamSchema.extend(otaPayloadSchema.shape))
      .output(z.object({ ok: z.literal(true) })),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update an existing doorlock device',
          method: 'PUT',
          operationId: 'putDoorlockDevicesById',
          path: '/doorlock/devices/{id}',
          tags: TAGS,
        })
      )
      .input(devicePayloadSchema.extend(idParamSchema.shape))
      .output(doorlockDeviceSchema),
    updateAll: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Trigger an OTA update on all devices',
          method: 'POST',
          operationId: 'postDoorlockDevicesUpdate',
          path: '/doorlock/devices/update',
          tags: TAGS,
        })
      )
      .input(otaPayloadSchema)
      .output(z.object({ count: z.number().int() })),
  },
  logs: {
    export: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Export doorlock audit log entries (attendance data) as a CSV file over an optional date range.',
          method: 'GET',
          operationId: 'getDoorlockLogsExport',
          path: '/doorlock/logs/export',
          tags: TAGS,
        })
      )
      .input(exportQuerySchema)
      .output(z.file()),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List audit log entries',
          method: 'GET',
          operationId: 'getDoorlockLogs',
          path: '/doorlock/logs',
          tags: TAGS,
        })
      )
      .input(logsQuerySchema)
      .output(doorlockLogListResponseSchema),
  },
  self: {
    cards: {
      activate: oc
        .route(
          filcRoute({
            auth: true,
            description:
              'Activate an authorized device using a user-owned virtual card',
            method: 'POST',
            operationId: 'postDoorlockSelfCardsByIdActivate',
            path: '/doorlock/self/cards/{id}/activate',
            tags: TAGS,
          })
        )
        .input(activateVirtualCardSchema.extend(idParamSchema.shape))
        .output(doorlockAuditLogSchema),
      list: oc
        .route(
          filcRoute({
            auth: true,
            description: 'List cards owned by the authenticated user',
            method: 'GET',
            operationId: 'getDoorlockSelfCards',
            path: '/doorlock/self/cards',
            tags: TAGS,
          })
        )
        .output(cardListResponseSchema),
      setFrozen: oc
        .route(
          filcRoute({
            auth: true,
            description: 'Update the frozen state of a user-owned card',
            method: 'PUT',
            operationId: 'putDoorlockSelfCardsByIdFrozen',
            path: '/doorlock/self/cards/{id}/frozen',
            tags: TAGS,
          })
        )
        .input(updateFrozenSchema.extend(idParamSchema.shape))
        .output(doorlockCardSchema),
    },
  },
  stats: {
    overview: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get aggregated doorlock statistics',
          method: 'GET',
          operationId: 'getDoorlockStatsOverview',
          path: '/doorlock/stats/overview',
          tags: TAGS,
        })
      )
      .output(doorlockStatsResponseSchema),
  },
};
