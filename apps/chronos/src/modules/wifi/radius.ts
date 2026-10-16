import { ORPCError } from '@orpc/server';
import { requireWifiEnabled } from '#middleware/wifi';
import { base } from '#orpc';
import { env } from '#utils/environment';
import { forbidden, notFound } from '#utils/http';
import { getWifiController } from './utils/controller';
import { authorizeRadius } from './utils/radius';

export const authorizeRadiusHandler = base.wifi.radius.authorize
  .use(requireWifiEnabled)
  .handler(async ({ context, input }) => {
    const sharedSecret =
      context.reqHeaders.get('X-FreeRADIUS-Secret') ?? input.sharedSecret;

    const result = await authorizeRadius(
      { ...input, sharedSecret },
      {
        controller: getWifiController() ?? undefined,
        encryptionSecret: env.wifiEncryptionSecret ?? '',
        freeradiusIp: env.freeradiusIp ?? '',
        realIp: context.clientIp,
        sharedSecret: env.freeradiusSharedSecret ?? '',
      }
    );

    switch (result.status) {
      case 200:
        return result.body as {
          'Cleartext-Password': string;
          'control:Cleartext-Password': string;
          'Session-Timeout': number;
        };
      case 403:
        throw forbidden(result.body.message as string);
      case 404:
        throw notFound(result.body.message as string);
      default:
        throw new ORPCError('INTERNAL', {
          message: result.body.message as string,
          status: 500,
        });
    }
  });
