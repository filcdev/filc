import { getLogger } from '@logtape/logtape';
import type { ServerWebSocket } from 'bun';
import { and, eq } from 'drizzle-orm';
import { upgradeWebSocket } from 'hono/bun';
import { db } from '~/database';
import {
  auditLog,
  card,
  cardDevice,
  deviceHealth,
  device as lockDevice,
} from '~/database/schema/doorlock';
import { server } from '~/index';
import { doorlockFactory } from '~/routes/doorlock/_factory';
import { env } from '~/utils/environment';

const logger = getLogger(['chronos', 'doorlock', 'websocket']);

type PingMessage = {
  type: 'ping';
  data: {
    fwVersion: string;
    uptime: bigint;
    ramFree: bigint;
    storage: {
      total: bigint;
      used: bigint;
    };
    debug: {
      lastResetReason: string;
      deviceState: number;
      errors: {
        nfc: boolean;
        sd: boolean;
        wifi: boolean;
        db: boolean;
        ota: boolean;
      };
    };
  };
};

type CardReadMessage = {
  type: 'card-read';
  uid: string;
  authorized: boolean;
  name: string;
};

type SyncDatabaseMessage = {
  type: 'sync-database';
  db: {
    uid: string;
    name: string;
  }[];
};

type OpenDoorMessage = {
  type: 'open-door';
  name?: string; // optional, defaults to "WebUser" on device
};

type UpdateMessage = {
  type: 'update';
  url?: string; // optional, uses device config default if omitted
};

type IncomingMessage = PingMessage | CardReadMessage;

type OutgoingMessage = SyncDatabaseMessage | OpenDoorMessage | UpdateMessage;

const handleIncomingMessage = async (
  message: string,
  device: { id: string }
) => {
  try {
    const deserialized = JSON.parse(message) as IncomingMessage;

    switch (deserialized.type) {
      case 'ping': {
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
        break;
      }
      case 'card-read':
        await db.insert(auditLog).values({
          buttonPressed: false,
          cardData: deserialized.uid,
          deviceId: device.id,
          result: deserialized.authorized,
        });
        break;
      default:
        logger.warn('Received unknown command via WebSocket', {
          command: deserialized,
        });
    }
  } catch (e) {
    logger.warn('Audit log store failed', { error: e });
  }
};

export const sendMessage = (content: OutgoingMessage, deviceId: string) => {
  if (!server) {
    if (env.mode === 'development') {
      logger.warn(
        'Websockets are unavailable due to hono-vite-devserver not supporting them.'
      );
    } else {
      logger.error("Can't access Bun server for publishing!");
    }
    return;
  }

  const payload: OutgoingMessage =
    content.type === 'open-door' && content.name
      ? { ...content, name: content.name.trim() }
      : content;

  server.publish(`device-${deviceId}`, JSON.stringify(payload));
};

export const syncDatabase = async (deviceId: string) => {
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
    name: c.card.name,
    uid: c.card.cardData,
  }));

  sendMessage(
    {
      db: database,
      type: 'sync-database',
    },
    deviceId
  );
};

export const websocketHandler = doorlockFactory.createHandlers(
  async (c, next) => {
    const gotToken = c.req.header('X-Aegis-Device-Token');
    if (!gotToken) {
      logger.warn('WebSocket connection attempt without device token');
      return c.status(401);
    }

    const [device] = await db
      .select()
      .from(lockDevice)
      .where(eq(lockDevice.apiToken, gotToken))
      .limit(1);

    if (!device) {
      logger.debug('WebSocket connection attempt with invalid device token', {
        token: gotToken,
      });
      return c.status(401);
    }

    const d = { id: device.id, name: device.name };

    logger.debug('WebSocket connection authorized', { device: d });

    c.set('device', d);
    return next();
  },
  upgradeWebSocket((c) => {
    const device = c.get('device') as { id: string; name: string } | undefined;

    if (!device) {
      throw new Error('Device not found in context');
    }

    return {
      onClose: (_e, ws) => {
        logger.info('Connection closed for device', { device });
        const raw = ws.raw as ServerWebSocket;
        raw.unsubscribe(`device-${device.id}`);
      },
      async onMessage(event, _ws) {
        const message = typeof event.data === 'string' ? event.data : '';
        await handleIncomingMessage(message, device);
      },
      async onOpen(_e, ws) {
        logger.debug('WebSocket connection opened', { device });
        const raw = ws.raw as ServerWebSocket;
        raw.subscribe(`device-${device.id}`);
        await syncDatabase(device.id);
      },
    };
  })
);
