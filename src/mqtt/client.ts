import { getLogger } from '@logtape/logtape';
import { connect, type MqttClient } from 'mqtt';
import { env } from '~/utils/environment';

const logger = getLogger(['chronos', 'mqtt']);

let client: MqttClient | null = null;

export const initializeMqttClient = () => {
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
}

export const handleMqttShutdown = () => {
  if (client) {
    client.end(() => {
      logger.info('MQTT client disconnected');
    });
  }
}

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
