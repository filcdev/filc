import { getLogger } from '@logtape/logtape';
import type { ServerWebSocket } from 'bun';
import { eq } from 'drizzle-orm';
import { upgradeWebSocket } from 'hono/bun';
import { db } from '~/database';
import { device as lockDevice } from '~/database/schema/doorlock';
import { doorlockFactory } from '~/routes/doorlock/_factory';

const logger = getLogger(['chronos', 'doorlock', 'websocket']);

const handleIncomingMessage = (message: string) => {
  const command = message.trim().toLowerCase();

  switch (command) {
    case 'unlock':
      logger.info('Received unlock command via WebSocket');
      // Here you would add the logic to unlock the door
      break;
    default:
      logger.warn('Received unknown command via WebSocket', { command });
  }
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
      onMessage(event, _ws) {
        const message = typeof event.data === 'string' ? event.data : '';
        handleIncomingMessage(message);
      },
      onOpen: (_e, ws) => {
        logger.debug('WebSocket connection opened', { device });
        const raw = ws.raw as ServerWebSocket;
        raw.subscribe(`device-${device.id}`);
      },
    };
  })
);
