import { getLogger } from '@logtape/logtape';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '#database';
import { server } from '#index';
import {
  auditLog,
  card,
  cardDevice,
  deviceHealth,
  device as lockDevice,
} from '#modules/doorlock/schema';
import {
  incomingMessageSchema,
  type OutgoingMessage,
  outgoingMessageSchema,
} from '#modules/doorlock/utils/schemas';
import { extractApiKey, validateApiKey } from '#utils/api-keys';
import { userHasPermission } from '#utils/authorization';
import { dispatchImmediateNotification } from '#utils/notifications/engine';

const logger = getLogger(['chronos', 'doorlock', 'websocket']);

export const DOORLOCK_SOCKET_PATH = '/api/doorlock/ws';

/** What a connected socket carries: the device it authenticated as. */
export type DeviceSocketData = { device: { id: string; name: string } };

const handleIncomingMessage = async (
  message: string,
  device: { id: string; name: string }
) => {
  try {
    logger.trace('Received raw WebSocket message', { device, message });
    const parsed = JSON.parse(message);
    const result = incomingMessageSchema.safeParse(parsed);

    if (!result.success) {
      logger.warn('Invalid WebSocket message format', {
        device,
        error: z.treeifyError(result.error),
        message,
      });
      return {
        details: result.error,
        error: 'INVALID_MESSAGE_FORMAT',
      };
    }

    const deserialized = result.data;
    logger.trace('Deserialized WebSocket message', {
      deserialized,
      device,
      message,
    });

    switch (deserialized.type) {
      case 'ping': {
        logger.trace('Handling ping message', { deserialized, device });
        const getDeviceState = () => {
          switch (deserialized.data.debug.deviceState) {
            case 0:
              return 'booting';
            case 1:
              return 'idle';
            case 2:
              return 'error';
            case 3:
              return 'updating';
            default:
              logger.warn('Received unexpected device status', {
                deserialized,
                device,
              });
              return 'error';
          }
        };

        logger.trace('Persisting device health ping', { device });
        await db.insert(deviceHealth).values({
          deviceId: device.id,
          deviceMeta: {
            ...deserialized.data,
            debug: {
              ...deserialized.data.debug,
              deviceState: getDeviceState(),
            },
          },
        });

        logger.trace('Updating device heartbeat timestamp', { device });
        await db
          .update(lockDevice)
          .set({ updatedAt: new Date() })
          .where(eq(lockDevice.id, device.id));
        break;
      }
      case 'card-read': {
        logger.trace('Handling card-read message', { deserialized, device });

        const [cardUser] = await db
          .select()
          .from(card)
          .where(eq(card.cardData, deserialized.uid))
          .limit(1);

        await db.insert(auditLog).values({
          buttonPressed: deserialized.buttonPressed,
          cardData: deserialized.uid,
          cardId: cardUser?.id ?? null,
          deviceId: device.id,
          result: deserialized.authorized,
          userId: cardUser?.userId ?? null,
        });

        dispatchImmediateNotification('doorlock_card_used', {
          deviceName: device.name,
          userId: cardUser?.userId,
        });

        logger.trace('Updating device heartbeat timestamp', { device });
        await db
          .update(lockDevice)
          .set({ updatedAt: new Date() })
          .where(eq(lockDevice.id, device.id));
        break;
      }
      default:
        logger.warn('Unhandled message type received', {
          deserialized,
          device,
        });
    }
    return null;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    logger.warn('Message handling failed', { device, error: err, message });
    return { details: err.message, error: 'MESSAGE_HANDLING_FAILED' };
  }
};

const normalizeName = (name: string) =>
  name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const sendMessage = (content: OutgoingMessage, deviceId: string) => {
  const validated = outgoingMessageSchema.parse(content);

  const payload: OutgoingMessage =
    validated.type === 'open-door' && validated.name
      ? { ...validated, name: normalizeName(validated.name) }
      : validated;

  logger.trace('Publishing WebSocket message', { deviceId, payload });
  server.publish(`device-${deviceId}`, JSON.stringify(payload));
};

export const syncDatabase = async (deviceId: string) => {
  logger.trace('Preparing database sync payload', { deviceId });
  const cards = await db
    .select()
    .from(card)
    .innerJoin(cardDevice, eq(card.id, cardDevice.cardId))
    .where(
      and(
        eq(cardDevice.deviceId, deviceId),
        eq(card.enabled, true),
        eq(card.frozen, false)
      )
    );

  const database = cards.map((c) => ({
    name: normalizeName(c.card.name),
    uid: c.card.cardData,
  }));

  logger.trace('Sending database sync payload', {
    count: database.length,
    deviceId,
  });
  sendMessage(
    {
      db: database,
      type: 'sync-database',
    },
    deviceId
  );
};

/**
 * Authenticate the connecting device and hand the socket to Bun. The aegis
 * firmware speaks a hand-rolled JSON protocol, so this endpoint is deliberately
 * not part of the oRPC contract.
 */
export async function upgrade(
  request: Request,
  srv: Bun.Server<DeviceSocketData>
): Promise<Response | undefined> {
  // Primary auth: the device's provisioned token.
  const gotToken = request.headers.get('X-Aegis-Device-Token');

  if (gotToken) {
    const [device] = await db
      .select()
      .from(lockDevice)
      .where(eq(lockDevice.apiToken, gotToken))
      .limit(1);

    if (!device) {
      logger.debug('WebSocket connection attempt with invalid device token', {
        token: gotToken,
      });
      return new Response(null, { status: 401 });
    }

    const d = { id: device.id, name: device.name };
    logger.debug('WebSocket connection authorized via device token', {
      device: d,
    });
    return connect(request, srv, d);
  }

  // Alternative auth: a user-generated API key (Bearer / X-API-Key).
  // The connecting client must also identify which device it represents.
  const rawKey = extractApiKey(request.headers);
  if (rawKey) {
    const apiUser = await validateApiKey(rawKey);
    if (!apiUser) {
      logger.debug('WebSocket connection attempt with invalid API key');
      return new Response(null, { status: 401 });
    }

    const canControl = await userHasPermission(
      apiUser.id,
      'doorlock:devices:read'
    );
    if (!canControl) {
      logger.debug('WebSocket connection with insufficient API key scope', {
        userId: apiUser.id,
      });
      return new Response(null, { status: 403 });
    }

    const deviceId = new URL(request.url).searchParams.get('deviceId');
    if (!deviceId) {
      return Response.json(
        {
          message: 'deviceId query parameter is required when using an API key',
        },
        { status: 400 }
      );
    }

    const [device] = await db
      .select()
      .from(lockDevice)
      .where(eq(lockDevice.id, deviceId))
      .limit(1);

    if (!device) {
      return Response.json({ message: 'Device not found' }, { status: 404 });
    }

    const d = { id: device.id, name: device.name };
    logger.debug('WebSocket connection authorized via API key', {
      device: d,
      userId: apiUser.id,
    });
    return connect(request, srv, d);
  }

  logger.warn('WebSocket connection attempt without any credentials');
  return Response.json(
    {
      message:
        'Authentication required: provide X-Aegis-Device-Token or an API key',
    },
    { status: 401 }
  );
}

function connect(
  request: Request,
  srv: Bun.Server<DeviceSocketData>,
  device: { id: string; name: string }
): Response | undefined {
  if (!srv.upgrade(request, { data: { device } })) {
    return new Response('WebSocket upgrade failed', { status: 400 });
  }

  return undefined;
}

export const handlers: Bun.WebSocketHandler<DeviceSocketData> = {
  close(ws) {
    const { device } = ws.data;
    logger.info('Connection closed for device', { device });
    logger.trace('Unsubscribing from device channel', {
      channel: `device-${device.id}`,
      device,
    });
    ws.unsubscribe(`device-${device.id}`);
  },

  async message(ws, raw) {
    const { device } = ws.data;
    const message = typeof raw === 'string' ? raw : '';
    logger.trace('WebSocket message event received', {
      device,
      isText: typeof raw === 'string',
    });
    const result = await handleIncomingMessage(message, device);
    if (result) {
      ws.send(JSON.stringify(result));
    }
  },

  async open(ws) {
    const { device } = ws.data;
    logger.debug('WebSocket connection opened', { device });
    logger.trace('Subscribing to device channel', {
      channel: `device-${device.id}`,
      device,
    });
    ws.subscribe(`device-${device.id}`);
    await syncDatabase(device.id);
  },
};
