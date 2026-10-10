import {
  radiusAuthorizeErrorSchema,
  radiusAuthorizeRequestSchema,
  radiusAuthorizeResponseSchema,
} from '@filcdev/api/domains/wifi/radius';
import { zValidator } from '@hono/zod-validator';
import { getConnInfo } from 'hono/bun';
import { describeRoute, resolver } from 'hono-openapi';
import { env } from '#utils/environment';
import { filcExt } from '#utils/openapi';
import type { RadiusAuthorizeRequest } from '#utils/wifi/radius';
import { authorizeRadius } from '#utils/wifi/radius';
import { wifiFactory } from './_factory';

const { schema: radiusAuthorizeRequestOpenApiSchema } = await resolver(
  radiusAuthorizeRequestSchema
).toOpenAPISchema();

import { getWifiController } from '#utils/wifi/controller';

export const authorizeRadiusRoute = wifiFactory.createHandlers(
  describeRoute({
    ...filcExt('WiFi', '@unit WifiRadiusAuthorizeResponse'),
    description: 'Authorize a WiFi client for FreeRADIUS.',
    requestBody: {
      content: {
        'application/json': { schema: radiusAuthorizeRequestOpenApiSchema },
      },
      required: true,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(radiusAuthorizeResponseSchema),
          },
        },
        description: 'WiFi client accepted.',
      },
      403: {
        content: {
          'application/json': { schema: resolver(radiusAuthorizeErrorSchema) },
        },
        description: 'WiFi client rejected.',
      },
      404: {
        content: {
          'application/json': { schema: resolver(radiusAuthorizeErrorSchema) },
        },
        description: 'WiFi account not found.',
      },
    },
    tags: ['WiFi'],
  }),
  zValidator('json', radiusAuthorizeRequestSchema),
  async (c) => {
    const request = c.req.valid('json');
    const sharedSecret =
      c.req.header('X-FreeRADIUS-Secret') ?? request.sharedSecret;

    const result = await authorizeRadius(
      { ...request, sharedSecret } as RadiusAuthorizeRequest,
      {
        controller: getWifiController() ?? undefined,
        encryptionSecret: env.wifiEncryptionSecret ?? '',
        freeradiusIp: env.freeradiusIp ?? '',
        realIp: env.realIpHeader
          ? c.req.header(env.realIpHeader)
          : getConnInfo(c).remote.address,
        sharedSecret: env.freeradiusSharedSecret ?? '',
      }
    );

    return c.json(result.body, result.status as 200 | 400 | 403 | 404 | 500);
  }
);
