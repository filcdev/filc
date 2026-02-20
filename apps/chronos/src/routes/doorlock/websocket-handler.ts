import { getLogger } from '@logtape/logtape';
import type { ServerWebSocket } from 'bun';
import { and, eq } from 'drizzle-orm';
import { upgradeWebSocket } from 'hono/bun';
import { z } from 'zod';
import { db } from '#database';
import {
  auditLog,
  card,
  cardDevice,
  deviceHealth,
  device as lockDevice,
} from '#database/schema/doorlock';
import { server } from '#index';
import { doorlockFactory } from '#routes/doorlock/_factory';

const logger = getLogger(['chronos', 'doorlock', 'websocket']);

const pingMessageSchema = z.object({
  data: z.object({
    debug: z.object({
      deviceState: z.number(),
      errors: z.object({
        db: z.boolean(),
        nfc: z.boolean(),
        ota: z.boolean(),
        sd: z.boolean(),
        wifi: z.boolean(),
      }),
      lastResetReason: z.string(),
    }),
    fwVersion: z.string(),
    ramFree: z.bigint(),
    storage: z.object({
      total: z.bigint(),
      used: z.bigint(),
    }),
    uptime: z.bigint(),
  }),
  type: z.literal('ping'),
});

const cardReadMessageSchema = z.object({
  authorized: z.boolean(),
  name: z.string(),
  type: z.literal('card-read'),
  uid: z.string(),
});

const incomingMessageSchema = z.discriminatedUnion('type', [
  pingMessageSchema,
  cardReadMessageSchema,
]);

// Zod schemas for outgoing messages
const syncDatabaseMessageSchema = z.object({
  db: z.array(
    z.object({
      name: z.string(),
      uid: z.string(),
    })
  ),
  type: z.literal('sync-database'),
});

const openDoorMessageSchema = z.object({
  name: z.string().optional(),
  type: z.literal('open-door'),
});

const updateMessageSchema = z.object({
  type: z.literal('update'),
  url: z.string().optional(),
});

const outgoingMessageSchema = z.discriminatedUnion('type', [
  syncDatabaseMessageSchema,
  openDoorMessageSchema,
  updateMessageSchema,
]);

type OutgoingMessage = z.infer<typeof outgoingMessageSchema>;

const handleIncomingMessage = async (
  message: string,
  device: { id: string }
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
      return;
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
      case 'card-read':
        logger.trace('Handling card-read message', { deserialized, device });
        await db.insert(auditLog).values({
          buttonPressed: false,
          cardData: deserialized.uid,
          deviceId: device.id,
          result: deserialized.authorized,
        });

        logger.trace('Updating device heartbeat timestamp', { device });
        await db
          .update(lockDevice)
          .set({ updatedAt: new Date() })
          .where(eq(lockDevice.id, device.id));
        break;
      default:
        logger.warn('Unhandled message type received', {
          deserialized,
          device,
        });
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    logger.warn('Message handling failed', { device, error: err, message });
  }
};

export const sendMessage = (content: OutgoingMessage, deviceId: string) => {
  const validated = outgoingMessageSchema.parse(content);

  const payload: OutgoingMessage =
    validated.type === 'open-door' && validated.name
      ? { ...validated, name: validated.name.trim() }
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
    name: c.card.name,
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
        logger.trace('Unsubscribing from device channel', {
          channel: `device-${device.id}`,
          device,
        });
        raw.unsubscribe(`device-${device.id}`);
      },
      async onMessage(event, _ws) {
        const message = typeof event.data === 'string' ? event.data : '';
        logger.trace('WebSocket message event received', {
          device,
          isText: typeof event.data === 'string',
        });
        await handleIncomingMessage(message, device);
      },
      async onOpen(_e, ws) {
        logger.debug('WebSocket connection opened', { device });
        const raw = ws.raw as ServerWebSocket;
        logger.trace('Subscribing to device channel', {
          channel: `device-${device.id}`,
          device,
        });
        raw.subscribe(`device-${device.id}`);
        await syncDatabase(device.id);
      },
    };
  })
);
