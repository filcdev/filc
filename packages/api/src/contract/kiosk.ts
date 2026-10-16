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
  kioskRowSchema,
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
        method: 'POST',
        operationId: 'postKiosk',
        path: '/kiosk',
        successStatus: 201,
        tags: ['Kiosk'],
      })
    )
    .input(createKioskSchema)
    .output(kioskRowSchema),
  delete: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Delete a kiosk',
        method: 'DELETE',
        operationId: 'deleteKioskById',
        path: '/kiosk/{id}',
        tags: ['Kiosk'],
      })
    )
    .input(kioskIdParamsSchema)
    .output(z.object({ id: z.uuid() })),
  departures: oc
    .route(
      filcRoute({
        description:
          'Next departure per configured group, trying each stop in order',
        method: 'POST',
        operationId: 'postKioskDepartures',
        path: '/kiosk/departures',
        tags: ['Kiosk'],
      })
    )
    .input(kioskDeparturesRequestSchema)
    .output(kioskDeparturesResponseSchema),
  heartbeat: oc
    .route(
      filcRoute({
        description:
          'Record a kiosk heartbeat and report whether the box is registered and enabled',
        method: 'POST',
        operationId: 'postKioskHeartbeat',
        path: '/kiosk/heartbeat',
        tags: ['Kiosk'],
      })
    )
    .input(kioskHeartbeatRequestSchema)
    .output(kioskHeartbeatResponseSchema),
  list: oc
    .route(
      filcRoute({
        auth: true,
        description: 'List all kiosks',
        method: 'GET',
        operationId: 'getKiosk',
        path: '/kiosk',
        tags: ['Kiosk'],
      })
    )
    .output(kioskListResponseSchema),
  news: {
    image: oc
      .route(
        filcRoute({
          description:
            'The image an announcement shows on the kiosk, as stored',
          method: 'GET',
          operationId: 'getKioskNewsByIdImage',
          path: '/kiosk/news/{id}/image',
          tags: ['Kiosk'],
        })
      )
      .input(kioskIdParamsSchema)
      .output(z.file()),
    list: oc
      .route(
        filcRoute({
          description:
            'Active, titled, non-cohort-scoped announcements for the TV kiosk marquee',
          method: 'GET',
          operationId: 'getKioskNews',
          path: '/kiosk/news',
          tags: ['Kiosk'],
        })
      )
      .output(kioskNewsResponseSchema),
  },
  petrikNews: oc
    .route(
      filcRoute({
        description:
          'petrik.hu news for the navigator kiosk, cached for ten minutes',
        method: 'GET',
        operationId: 'getKioskPetrikNews',
        path: '/kiosk/petrik-news',
        tags: ['Kiosk'],
      })
    )
    .input(kioskPetrikNewsQuerySchema)
    .output(kioskPetrikNewsResponseSchema),
  update: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Update a kiosk',
        method: 'PUT',
        operationId: 'putKioskById',
        path: '/kiosk/{id}',
        tags: ['Kiosk'],
      })
    )
    .input(kioskIdParamsSchema.extend(updateKioskSchema.shape))
    .output(kioskRowSchema),
  weather: oc
    .route(
      filcRoute({
        description: 'Current weather for the TV kiosk, cached for ten minutes',
        method: 'GET',
        operationId: 'getKioskWeather',
        path: '/kiosk/weather',
        tags: ['Kiosk'],
      })
    )
    .output(kioskWeatherResponseSchema),
};
