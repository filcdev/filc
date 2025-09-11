import { getLogger } from '@logtape/logtape';
import { and, eq, exists } from 'drizzle-orm';
import { connect, type MqttClient } from 'mqtt';
import { db } from '~/database';
import { card, cardDevice, device } from '~/database/schema/doorlock';
import { env } from '~/utils/environment';
import { handleFeatureFlag } from '~/utils/feature-flag';

const logger = getLogger(['chronos', 'mqtt']);

let client: MqttClient | null = null;

export const initializeMqttClient = async () => {
  const enabled = await handleFeatureFlag(
    'doorlock:mqtt',
    'Enable MQTT client for door lock integration',
    false
  );

  if (!enabled) {
    logger.info('MQTT client is disabled via feature flag');
    return;
  }

  if (client) {
    return client;
  }

  client = connect(env.mqttBrokerUrl);

  client.on('connect', () => {
    logger.info('Connected to MQTT broker');
  });

  client.on('error', (_err: unknown) => {
    logger.error(`MQTT connection error: ${_err}`);
    client?.end();
    client = null;
  });

  client.on('close', () => {
    logger.warn('MQTT connection closed');
    client = null;
  });

  client.subscribe('#', (err) => {
    if (err) {
      logger.error(`Subscription error: ${err}`);
    } else {
      logger.info('Subscribed to all topics');
    }
  });

  client.on('message', async (topic, payload) => {
    await handleIncomingMessage(topic, payload);
  });
};

export const handleMqttShutdown = () => {
  if (client) {
    client.end(() => {
      logger.info('MQTT client disconnected');
    });
  }
};

export const pub = (topic: string, message: string): void => {
  if (!client) {
    logger.error('MQTT client is not initialized');
    return;
  }

  client.publish(topic, message, (err) => {
    if (err) {
      logger.error(`Publish error: ${err}`);
    } else {
      logger.debug(`Message published to ${topic}`);
    }
  });
};

export const openDoorLock = (
  lockId: string,
  displayMessage = 'Access granted'
): void => {
  sendDoorlockCommand(lockId, 'open', displayMessage);
};

export const sendDoorlockCommand = (
  deviceId: string,
  action: 'open' | 'deny',
  message: string
) => {
  pub(`filc/doorlock/${deviceId}/command`, JSON.stringify({ action, message }));
};

type DoorlockEventBase = { api_key?: string; timestamp?: number };
type DoorlockEvent = DoorlockEventBase & Partial<{ tag: string }>;

const handleIncomingMessage = async (topic: string, payload: Buffer) => {
  let message: DoorlockEvent | null = null;
  try {
    message = JSON.parse(payload.toString()) as DoorlockEvent;
  } catch {
    logger.warn('Non-JSON payload received, ignoring', { topic });
    return;
  }

  if (!topic.startsWith('filc/doorlock/')) {
    return;
  }

  logger.trace('Handling door lock message', { topic, message });
  const parts = topic.split('/');
  const deviceId: string = parts[2] ?? '';
  const section = parts[3];
  if (section !== 'events') {
    return;
  }
  const eventType = parts[4];

  // heartbeat: filc/doorlock/<deviceId>/events/heartbeat
  if (eventType === 'heartbeat') {
    await upsertDeviceHeartbeat(deviceId);
    return;
  }

  if (eventType === 'rfid') {
    await handleRfidEvent(deviceId, message);
    return;
  }
  if (eventType === 'button') {
    logger.info('Button press event', { deviceId });
    return;
  }
  logger.debug('Unhandled doorlock event type', { eventType });
};

const handleRfidEvent = async (
  deviceId: string,
  message: DoorlockEvent | null
) => {
  const tag = message?.tag;
  if (!tag) {
    logger.warn('RFID event without tag');
    return;
  }
  try {
    // Find card and simultaneously check restriction mapping
    const [found] = await db
      .select({
        id: card.id,
        frozen: card.frozen,
        disabled: card.disabled,
        label: card.label,
        restricted: exists(
          db
            .select({ one: cardDevice.cardId })
            .from(cardDevice)
            .where(eq(cardDevice.cardId, card.id))
        ).as('restricted'),
        allowedForDevice: exists(
          db
            .select({ one: cardDevice.cardId })
            .from(cardDevice)
            .where(
              and(
                eq(cardDevice.cardId, card.id),
                eq(cardDevice.deviceId, deviceId)
              )
            )
        ).as('allowed_for_device'),
      })
      .from(card)
      .where(eq(card.tag, tag))
      .limit(1);
    if (!found) {
      logger.debug('Unknown card tag', { tag, deviceId });
      sendDoorlockCommand(deviceId, 'deny', 'Unknown card');
      return;
    }
    if (found.disabled) {
      sendDoorlockCommand(deviceId, 'deny', 'Card disabled');
      return;
    }
    if (found.frozen) {
      sendDoorlockCommand(deviceId, 'deny', 'Card frozen');
      return;
    }
    // If card is restricted (has mapping rows) but this device is not among them
    // deny access.
    if (found.restricted && !found.allowedForDevice) {
      sendDoorlockCommand(deviceId, 'deny', 'Not allowed on this device');
      return;
    }
    sendDoorlockCommand(deviceId, 'open', found.label ?? 'Access granted');
  } catch (err) {
    logger.error('DB error while processing RFID event', { err });
    sendDoorlockCommand(deviceId, 'deny', 'System error');
  }
};

// Upsert device heartbeat (create device row if missing, update lastSeenAt)
const upsertDeviceHeartbeat = async (deviceId: string) => {
  if (!deviceId) {
    return;
  }
  try {
    const now = new Date();
    // Attempt update first
    const result = await db
      .update(device)
      .set({ lastSeenAt: now, status: 'online', updatedAt: now })
      .where(eq(device.id, deviceId))
      .returning({ id: device.id });
    if (result.length === 0) {
      await db.insert(device).values({
        id: deviceId,
        name: deviceId,
        lastSeenAt: now,
        status: 'online',
        ttlSeconds: 30,
        createdAt: now,
        updatedAt: now,
      });
      logger.info('Registered new device via heartbeat', { deviceId });
    }
  } catch (err) {
    logger.error('Failed to upsert device heartbeat', { deviceId, err });
  }
};
