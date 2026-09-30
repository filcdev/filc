import { oc } from '@orpc/contract';
import z from 'zod';
import {
  cardListResponseSchema,
  cardResponseSchema,
  createCardSchema,
  doorlockUserListResponseSchema,
  updateCardSchema,
} from '../domains/doorlock/cards';
import {
  deviceListResponseSchema,
  devicePayloadSchema,
  deviceResponseSchema,
  idParamSchema,
  idResponseSchema,
} from '../domains/doorlock/devices';
import { exportQuerySchema } from '../domains/doorlock/export';
import {
  doorlockLogListResponseSchema,
  logsQuerySchema,
} from '../domains/doorlock/logs';
import { otaPayloadSchema } from '../domains/doorlock/ota';
import {
  activateVirtualCardSchema,
  doorlockActivationResponseSchema,
  updateFrozenSchema,
} from '../domains/doorlock/self';
import {
  deviceStatsPayloadSchema,
  doorlockStatsResponseSchema,
} from '../domains/doorlock/stats';
import { filcRoute } from './route';

const TAGS = ['Doorlock'];
const GROUP = 'Doorlock';

export const doorlockContract = {
  cards: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new access card',
          group: GROUP,
          method: 'POST',
          operationId: 'postDoorlockCards',
          path: '/doorlock/cards',
          successStatus: 201,
          tags: TAGS,
          type: '@unit CardResponse @field(.card, Card)',
        })
      )
      .input(createCardSchema)
      .output(cardResponseSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete an access card',
          group: GROUP,
          method: 'DELETE',
          operationId: 'deleteDoorlockCardsById',
          path: '/doorlock/cards/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@nodata',
        })
      )
      .input(idParamSchema)
      .output(idResponseSchema),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List all access cards',
          group: GROUP,
          method: 'GET',
          operationId: 'getDoorlockCards',
          path: '/doorlock/cards',
          successStatus: 200,
          tags: TAGS,
          type: '@unit CardListResponse @field(.cards, List<Card>)',
        })
      )
      .output(cardListResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update an access card',
          group: GROUP,
          method: 'PUT',
          operationId: 'putDoorlockCardsById',
          path: '/doorlock/cards/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@unit CardResponse @field(.card, Card)',
        })
      )
      .input(updateCardSchema.extend(idParamSchema.shape))
      .output(cardResponseSchema),
    users: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List users eligible for card ownership',
          group: GROUP,
          method: 'GET',
          operationId: 'getDoorlockCardsUsers',
          path: '/doorlock/cards/users',
          successStatus: 200,
          tags: TAGS,
          type: '@unit DoorlockUserListResponse @field(.users, List<DoorlockUser>)',
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
          group: GROUP,
          method: 'POST',
          operationId: 'postDoorlockDevices',
          path: '/doorlock/devices',
          successStatus: 201,
          tags: TAGS,
          type: '@unit DeviceResponse @field(.device, Device)',
        })
      )
      .input(devicePayloadSchema)
      .output(deviceResponseSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a doorlock device',
          group: GROUP,
          method: 'DELETE',
          operationId: 'deleteDoorlockDevicesById',
          path: '/doorlock/devices/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@nodata',
        })
      )
      .input(idParamSchema)
      .output(idResponseSchema),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List all doorlock devices',
          group: GROUP,
          method: 'GET',
          operationId: 'getDoorlockDevices',
          path: '/doorlock/devices',
          successStatus: 200,
          tags: TAGS,
          type: '@unit DeviceListResponse @field(.devices, List<Device>)',
        })
      )
      .output(deviceListResponseSchema),
    stats: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get device health statistics',
          group: GROUP,
          method: 'GET',
          operationId: 'getDoorlockDevicesByIdStats',
          path: '/doorlock/devices/{id}/stats',
          successStatus: 200,
          tags: TAGS,
          type: '@unit DeviceStatsResponse @field(.stats, List<DeviceHealthStat>)',
        })
      )
      .input(idParamSchema)
      .output(deviceStatsPayloadSchema),
    triggerOta: oc
      .route(
        filcRoute({
          description: 'Trigger an OTA update on a specific device',
          method: 'POST',
          operationId: 'postDoorlockDevicesByIdUpdate',
          path: '/doorlock/devices/{id}/update',
          successStatus: 200,
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
          group: GROUP,
          method: 'PUT',
          operationId: 'putDoorlockDevicesById',
          path: '/doorlock/devices/{id}',
          successStatus: 200,
          tags: TAGS,
          type: '@unit DeviceResponse @field(.device, Device)',
        })
      )
      .input(devicePayloadSchema.extend(idParamSchema.shape))
      .output(deviceResponseSchema),
    updateAll: oc
      .route(
        filcRoute({
          description: 'Trigger an OTA update on all devices',
          method: 'POST',
          operationId: 'postDoorlockDevicesUpdate',
          path: '/doorlock/devices/update',
          successStatus: 200,
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
          group: GROUP,
          method: 'GET',
          operationId: 'getDoorlockLogsExport',
          path: '/doorlock/logs/export',
          successStatus: 200,
          tags: TAGS,
          type: 'Export audit log entries as CSV',
        })
      )
      .input(exportQuerySchema)
      .output(z.file()),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description: 'List audit log entries',
          group: GROUP,
          method: 'GET',
          operationId: 'getDoorlockLogs',
          path: '/doorlock/logs',
          successStatus: 200,
          tags: TAGS,
          type: '@unit DoorlockLogListResponse @field(.logs, List<DoorlockLogEntry>)',
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
            group: GROUP,
            method: 'POST',
            operationId: 'postDoorlockSelfCardsByIdActivate',
            path: '/doorlock/self/cards/{id}/activate',
            successStatus: 200,
            tags: TAGS,
            type: '@unit DoorlockActivationResponse @field(.log, AuditLog)',
          })
        )
        .input(activateVirtualCardSchema.extend(idParamSchema.shape))
        .output(doorlockActivationResponseSchema),
      list: oc
        .route(
          filcRoute({
            auth: true,
            description: 'List cards owned by the authenticated user',
            group: GROUP,
            method: 'GET',
            operationId: 'getDoorlockSelfCards',
            path: '/doorlock/self/cards',
            successStatus: 200,
            tags: TAGS,
            type: '@unit CardListResponse @field(.cards, List<Card>)',
          })
        )
        .output(cardListResponseSchema),
      setFrozen: oc
        .route(
          filcRoute({
            auth: true,
            description: 'Update the frozen state of a user-owned card',
            group: GROUP,
            method: 'PUT',
            operationId: 'putDoorlockSelfCardsByIdFrozen',
            path: '/doorlock/self/cards/{id}/frozen',
            successStatus: 200,
            tags: TAGS,
            type: '@unit CardResponse @field(.card, Card)',
          })
        )
        .input(updateFrozenSchema.extend(idParamSchema.shape))
        .output(cardResponseSchema),
    },
  },
  stats: {
    overview: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get aggregated doorlock statistics',
          group: GROUP,
          method: 'GET',
          operationId: 'getDoorlockStatsOverview',
          path: '/doorlock/stats/overview',
          successStatus: 200,
          tags: TAGS,
          type: '@unit DoorlockStatsResponse @field(.stats, DoorlockStats)',
        })
      )
      .output(doorlockStatsResponseSchema),
  },
};
