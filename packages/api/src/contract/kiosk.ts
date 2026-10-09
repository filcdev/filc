import { oc } from '@orpc/contract';
import z from 'zod';
import {
  kioskDeparturesRequestSchema,
  kioskPetrikNewsQuerySchema,
} from '../domains/kiosk/config';
import {
  createKioskSchema,
  kioskIdParamsSchema,
  updateKioskSchema,
} from '../domains/kiosk/crud';
import {
  kioskHeartbeatRequestSchema,
  kioskHeartbeatResponseSchema,
} from '../domains/kiosk/heartbeat';
import {
  kioskDeparturesResponseSchema,
  kioskListResponseSchema,
  kioskNewsResponseSchema,
  kioskPetrikNewsResponseSchema,
  kioskResponseSchema,
  kioskWeatherResponseSchema,
} from '../domains/kiosk/responses';
import { filcRoute } from './route';

/**
 * The kiosk feature: the admin registry (`list`/`create`/`update`/`delete`,
 * permission-gated) plus the public endpoints the boxes themselves call
 * (`heartbeat`, `news`, `petrikNews`, `weather`, `departures`).
 */
export const kioskContract = {
  create: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Register a kiosk',
        group: 'Kiosk',
        method: 'POST',
        operationId: 'postKiosk',
        path: '/kiosk',
        successStatus: 201,
        tags: ['Kiosk'],
        type: '@unit KioskResponse @field(.kiosk, Kiosk)',
      })
    )
    .input(createKioskSchema)
    .output(kioskResponseSchema),
  delete: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Delete a kiosk',
        group: 'Kiosk',
        method: 'DELETE',
        operationId: 'deleteKioskById',
        path: '/kiosk/{id}',
        successStatus: 200,
        tags: ['Kiosk'],
        type: '@unit KioskResponse @field(.kiosk, Kiosk)',
      })
    )
    .input(kioskIdParamsSchema)
    .output(kioskResponseSchema),
  departures: oc
    .route(
      filcRoute({
        description:
          'Next departure per configured group, trying each stop in order',
        group: 'Kiosk',
        method: 'POST',
        operationId: 'postKioskDepartures',
        path: '/kiosk/departures',
        successStatus: 200,
        tags: ['Kiosk'],
        type: '@unit KioskDeparturesResponse @field(.departures, List<KioskDeparture>)',
      })
    )
    .input(kioskDeparturesRequestSchema)
    .output(kioskDeparturesResponseSchema),
  heartbeat: oc
    .route(
      filcRoute({
        description:
          'Record a kiosk heartbeat and report whether the box is registered and enabled',
        group: 'Kiosk',
        method: 'POST',
        operationId: 'postKioskHeartbeat',
        path: '/kiosk/heartbeat',
        successStatus: 200,
        tags: ['Kiosk'],
        type: '@unit KioskHeartbeatResponse @field(.kiosk, Kiosk)',
      })
    )
    .input(kioskHeartbeatRequestSchema)
    .output(kioskHeartbeatResponseSchema),
  list: oc
    .route(
      filcRoute({
        auth: true,
        description: 'List all kiosks',
        group: 'Kiosk',
        method: 'GET',
        operationId: 'getKiosk',
        path: '/kiosk',
        successStatus: 200,
        tags: ['Kiosk'],
        type: '@unit KioskListResponse @field(.kiosks, List<Kiosk>)',
      })
    )
    .output(kioskListResponseSchema),
  news: {
    image: oc
      .route(
        filcRoute({
          description:
            'The image an announcement shows on the kiosk, as stored',
          group: 'Kiosk',
          method: 'GET',
          operationId: 'getKioskNewsByIdImage',
          path: '/kiosk/news/{id}/image',
          successStatus: 200,
          tags: ['Kiosk'],
          type: '@unit KioskNewsImage',
        })
      )
      .input(kioskIdParamsSchema)
      .output(z.file()),
    list: oc
      .route(
        filcRoute({
          description:
            'Active, titled, non-cohort-scoped announcements for the TV kiosk marquee',
          group: 'Kiosk',
          method: 'GET',
          operationId: 'getKioskNews',
          path: '/kiosk/news',
          successStatus: 200,
          tags: ['Kiosk'],
          type: '@unit KioskNewsResponse @field(.announcements, List<KioskAnnouncement>)',
        })
      )
      .output(kioskNewsResponseSchema),
  },
  petrikNews: oc
    .route(
      filcRoute({
        description:
          'petrik.hu news for the navigator kiosk, cached for ten minutes',
        group: 'Kiosk',
        method: 'GET',
        operationId: 'getKioskPetrikNews',
        path: '/kiosk/petrik-news',
        successStatus: 200,
        tags: ['Kiosk'],
        type: '@unit KioskPetrikNewsResponse',
      })
    )
    .input(kioskPetrikNewsQuerySchema)
    .output(kioskPetrikNewsResponseSchema),
  update: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Update a kiosk',
        group: 'Kiosk',
        method: 'PUT',
        operationId: 'putKioskById',
        path: '/kiosk/{id}',
        successStatus: 200,
        tags: ['Kiosk'],
        type: '@unit KioskResponse @field(.kiosk, Kiosk)',
      })
    )
    .input(kioskIdParamsSchema.extend(updateKioskSchema.shape))
    .output(kioskResponseSchema),
  weather: oc
    .route(
      filcRoute({
        description: 'Current weather for the TV kiosk, cached for ten minutes',
        group: 'Kiosk',
        method: 'GET',
        operationId: 'getKioskWeather',
        path: '/kiosk/weather',
        successStatus: 200,
        tags: ['Kiosk'],
        type: '@unit KioskWeatherResponse',
      })
    )
    .output(kioskWeatherResponseSchema),
};
