import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { env } from '#utils/environment';
import { ok } from '#utils/http';
import { filcExt } from '#utils/openapi';
import { wifiFactory } from './_factory';

const wifiStatusSchema = z.object({
  enabled: z.boolean(),
  ssid: z.string().nullable(),
});

export const wifiStatusRoute = wifiFactory.createHandlers(
  describeRoute({
    ...filcExt('WiFi', '@unit WifiStatusResponse'),
    description: 'Get the WiFi module status and configured SSID.',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(wifiStatusSchema) },
        },
        description: 'WiFi status',
      },
    },
    tags: ['WiFi'],
  }),
  (c) =>
    ok(c, {
      enabled: env.wifiEnabled,
      ssid: env.wifiSsid || null,
    })
);
